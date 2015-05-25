import Rx from 'rx';

class PriceRepository {

    constructor(pricingServiceClient:IPricingServiceClient, priceFactory:IPriceFactory) {
        this._priceFactory = priceFactory;
        this._pricingServiceClient = pricingServiceClient;
    }

    getPriceStream(currencyPair:ICurrencyPair):Rx.Observable<IPrice> {
        return Rx.Observable.defer(()=> this._pricingServiceClient.getSpotPriceStream(currencyPair.symbol))
            .select(p=> this._priceFactory.create(p, currencyPair))
            .catch(ex => {
                console.error("Error thrown in stream " + currencyPair.symbol + ": " + ex);
                // if the stream errors (server disconnected), we push a stale price
                return Rx.Observable
                    .return(new StalePrice(currencyPair))
                    // terminate the observable in 3sec so the repeat does not kick-off immediatly
                    .concat(Rx.Observable.timer(3000, Rx.Scheduler.timeout).ignoreElements().select(_=> new StalePrice(currencyPair)));
            })
            .repeat()
            .detectStale(4000, Rx.Scheduler.timeout)
            .select(s => s.isStale ? new StalePrice(currencyPair) : s.update)
            .publish()
            .refCount();
    }
}

var repo = new PriceRepository();
export default repo;