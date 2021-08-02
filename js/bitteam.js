'use strict'

// ----------------------------------------------------------------------------

const Exchange = require('./base/Exchange');
const {ArgumentsRequired, ExchangeError} = require('./base/errors');
const type = require('./base/functions/type');

// ----------------------------------------------------------------------------

module.exports = class bitteam extends Exchange {
    describe() {
        return this.deepExtend(super.describe(), {
            'id': '',
            'name': '',
            'countries': '',
            'version': '',
            'has': {
                'fetchCurrencies': true,
                'fetchMarkets': true,
                'fetchTrades': true,
                'fetchTicker': true,
                'fetchOrderBook': true,
                'fetchOHLCV': true,
                'fetchOrder': true,
                'fetchOpenOrders': true,
                'fetchOrders': true,
                'fetchClosedOrders': true,
                'fetchMyTrades': true,
                'fetchDepositAddress': true,
                'fetchDeposits': true,
                'fetchWithdrawals': true,
            },
            'timeframes': {
                '1m': '1',
                '5m': '5',
                '15m': '15',
                '60m': '60',
                '1d': '1D',
            },
            'urls': {},
            'api': {
                'public': {
                    'get': [
                        'currencies',
                        'pairs',
                        'trades',
                        'pair/{ticker}'
                    ]
                },
                'private': {
                    'get': [
                        'order/{id}',
                        'ordersByUser',
                        'tradesByUser',
                        'address/{currencyId}',
                        'transactions/{type}',
                        'transactionsByUser',
                        'ccxt/balance',
                    ],
                    'post': [
                        'ccxt/ordercreate',
                    ]
                },
                'tw': {
                    'get': [
                        'tw/history/{pair}/{res}'
                    ]
                }
            }
        })
    }

    sign(path, api = 'public', method = 'GET', params = {}, headers = undefined, body = undefined) {
        const query = this.omit(params, this.extractParams(path));
        let url = this.urls['api'][api] + '/';
        if (api === 'public') {
            if (Object.keys(query).length) {
                url += '?' + this.urlencode(query);
            }
        } else {
            this.checkRequiredCredentials();
            const nonce = this.nonce().toString();
            body = this.json(query);
            let auth = nonce;
            auth += '/' + path + body;
            headers = {
                'Content-Type': 'application/json',
                'ACCESS-KEY': this.apiKey,
                'ACCESS-TIMESTAMP': this.nonce(),
                'ACCESS-SIGN': this.hmac(this.encode(auth), this.encode(this.secret)),
            };
        }
        return {'url': url, 'method': method, 'body': body, 'headers': headers};
    }

    parseResponse(response, field) {
        const data = this.safeValue(response, 'result');
        if (field !== undefined) {
            const parsedResponse = this.safeValue(data, field);
            return parsedResponse;
        } else {
            return data;
        }
    }

    async fetchCurrencies(params = {}) {
        const response = await this.publicGetCurrencies(params);
        const currencies = this.parseResponse(response, 'currencies');
        // [
        //   {
        //       "id": 11,
        //       "symbol": "btc",
        //       "title": "Bitcoin",
        //       "logoURL": "https://img2.freepng.ru/20171216/19e/bitcoin-png-5a354f46d0c7d2.8667284615134431428552.jpg",
        //       "isDiscount": null,
        //       "address": "https://bitcoin.org/",
        //       "description": "Bitcoin currency",
        //       "decimals": 8,
        //       "blockChain": "Bitcoin",
        //       "currentRate": null,
        //       "active": true,
        //       "timeStart": "2021-01-29T04:53:05.762Z",
        //       "txLimits": {
        //           "maxWithdraw": "1000",
        //           "minWithdraw": "0.0005",
        //           "withdrawCommissionFixed": "0.001",
        //           "withdrawCommissionPercentage": "NaN"
        //       },
        //       "type": "crypto"
        //   },
        // ]
        const result = [];
        for (let i = 0; i < currencies.length; i++) {
            const entity = currencies[i];
            const id = this.safeString(entity, 'symbol');
            const code = this.safeCurrencyCode(id);
            const name = this.safeString(entity, 'title');
            const active = this.safeValue(entity, 'active');
            const tx = this.safeValue(entity, 'txLimits');
            const fee = this.safeNumber(tx, 'withdrawCommissionFixed');
            const precision = this.safeNumber(entity, 'decimals');
            const wMin = this.safeNumber(tx, 'minWithdraw');
            const wMax = this.safeNumber(tx, 'maxWithdraw');
            result.push({
                'id': id,
                'code': code,
                'name': name,
                'active': active,
                'fee': fee,
                'precision': precision,
                'limits': {
                    'withdraw': {
                        'min': wMin,
                        'max': wMax,
                    },
                },
                'info': entity,
            });
        }
        return result;
    }

    convertMarket(market) {
        const id = this.safeString(market, 'name');
        const baseId = market.fullName.split(' ')[0];
        const quoteId = market.fullName.split(' ')[1];
        const base = this.safeCurrencyCode(baseId);
        const quote = this.safeCurrencyCode(quoteId);
        const symbol = base + '/' + quote;
        const baseId = this.safeString(market, 'baseAssetId');
        const quoteId = this.safeString(market, 'quoteAssetId');
        const active = this.safeValue(market, 'active');
        const taker = this.safeNumber(market, 'takerFee');
        const maker = this.safeNumber(market, 'makerFee');
        const precision = {
            'base': this.safeNumber(market, 'baseStep'),
            'quote': this.safeNumber(market, 'quoteStep'),
        };
        const settings = this.safeValue(market, 'settings');
        const limits = {
            'price': {
                'min': parseFloat(this.safeString(settings, 'price_min')),
                'max': parseFloat(this.safeString(settings, 'price_max')),
            },
        };
        const entry = {
            'id': id,
            'symbol': symbol,
            'base': base,
            'quote': quote,
            'baseId': baseId,
            'quoteId': quoteId,
            'active': active,
            'taker': taker,
            'maker': maker,
            'precision': precision,
            'limits': limits,
            'info': market,
        };
        return entry;
    }

    async fetchMarkets(params = {}) {
        const response = await this.publicGetPairs(params);
        const markets = this.parseResponse(response, 'pairs');
        // [
        //   {
        //       "id": 2,
        //       "name": "eth_usdt",
        //       "baseAssetId": 2,
        //       "quoteAssetId": 3,
        //       "fullName": "ETH USDT",
        //       "description": "ETH   USDT",
        //       "lastBuy": 13,
        //       "lastSell": 13,
        //       "lastPrice": 13,
        //       "change24": 0,
        //       "volume24": 3184.0000000000014,
        //       "active": true,
        //       "baseStep": 8,
        //       "quoteStep": 6,
        //       "status": 1,
        //       "settings": {
        //           "price_max": "1000000000000000",
        //           "price_min": "1",
        //           "price_tick": "1",
        //           "lot_size_max": "1000000000000000",
        //           "lot_size_min": "1",
        //           "lot_size_tick": "1",
        //           "price_max_quote": "10000000000000",
        //           "price_min_quote": "1000000",
        //           "default_slippage": 16,
        //           "price_tick_quote": "1000000",
        //           "lot_size_max_quote": "10000000000000",
        //           "lot_size_min_quote": "10000",
        //           "lot_size_tick_quote": "10000"
        //       },
        //       "updateId": "1",
        //       "timeStart": "2021-01-28T09:19:30.706Z",
        //       "makerFee": 200,
        //       "takerFee": 200
        //   }
        // ]
        const result = [];
        for (let i = 0; i < markets.length; i++) {
            result.push(this.convertMarket(markets[i]));
        }
        return result;
    }

    parseTrade(trade, market = undefined) {
        const id = this.safeString(trade, 'tradeId');
        const timestamp = this.safeNumber(trade, 'timestamp');
        const marketId = this.safeString(trade, 'pair');
        market = this.safeMarket(marketId, market, '_');
        const side = this.safeString(trade, 'side');
        const isMaker = this.safeValue(trade, 'isBuyerMaker');
        const takerOrMaker = isMaker ? 'maker' : 'taker';
        const price = this.safeNumber(trade, 'price');
        const amount = this.safeNumber(trade, 'quantity');
        const cost = price * amount;
        return {
            'info': trade,
            'id': id,
            'timestamp': timestamp,
            'datetime': this.iso8601(timestamp),
            'symbol': market['symbol'],
            'side': side,
            'takerOrMaker': takerOrMaker,
            'price': price,
            'amount': amount,
            'cost': cost,
        }
    }

    async fetchTrades(symbol, since = undefined, limit = undefined, params = {}) {
        await this.loadMarkets();
        const market = this.market(symbol);
        const request = {
            'limit': limit,
            'pairId': market['id'],
        }
        const response = await this.publicGetTrades(this.extend(request, params));
        const trades = this.parseResponse(response, 'trades');
        // [
        //   {
        //       "id": 345970,
        //       "tradeId": "2",
        //       "makerOrderId": "2",
        //       "takerOrderId": "5",
        //       "pairId": 24,
        //       "quantity": 1000000000000000000,
        //       "price": 14000000,
        //       "isBuyerMaker": true,
        //       "baseDecimals": 18,
        //       "quoteDecimals": 6,
        //       "side": "sell",
        //       "timestamp": 1626860623,
        //       "rewarded": false,
        //       "makerUserId": 57,
        //       "takerUserId": 50,
        //       "baseCurrencyId": 9,
        //       "quoteCurrencyId": 3,
        //       "feeMaker": {
        //           "amount": "200000000000000000",
        //           "symbol": "btt",
        //           "userId": 57,
        //           "decimals": 18,
        //           "symbolId": 5
        //       },
        //       "feeTaker": {
        //           "amount": "615384610000000000",
        //           "symbol": "btt",
        //           "userId": 50,
        //           "decimals": 18,
        //           "symbolId": 5
        //       },
        //       "pair": "del_usdt"
        //   }
        // ]
        return this.parseTrades(trades, market, since, limit);
    }

    parseTicker(ticker, market = undefined) {
        const marketId = this.safeString(ticker, 'name');
        market = this.safeMarket(marketId, market, '-');
        const timestamp = this.milliseconds();
        return {
            'symbol': market['symbol'],
            'info': ticker,
            'timestamp': timestamp,
            'datetime': this.iso8601(timestamp),
            'high': undefined,
            'low': undefined,
            'bid': undefined,
            'bidVolume': undefined,
            'ask': undefined,
            'askVolume': undefined,
            'vwap': undefined,
            'open': undefined,
            'close': last,
            'last': last,
            'previousClose': undefined,
            'change': undefined,
            'percentage': undefined,
            'average': undefined,
            'baseVolume': undefined,
            'quoteVolume': undefined,
        };
    }

    async fetchTicker(symbol, params = {}) {
        await this.loadMarkets();
        const market = this.market(symbol);
        const request = {
            'ticker': market['id'],
        };
        const response = await this.publicGetPairTicker(this.extend(request, params));
        const ticker = parseResponse(response, 'pair');
        // {
        //   "id": 6,
        //   "name": "eth_del",
        //   "baseAssetId": 2,
        //   "quoteAssetId": 9,
        //   "fullName": "ETH DEL",
        //   "description": "ETH DEL pair",
        //   "lastBuy": 12,
        //   "lastSell": 12,
        //   "lastPrice": 12,
        //   "change24": 0,
        //   "volume24": 4358,
        //   "active": true,
        //   "baseStep": 8,
        //   "quoteStep": 8,
        //   "status": 1,
        //   "settings": {
        //       "price_max": "1000000000000000",
        //       "price_min": "1",
        //       "price_tick": "1",
        //       "lot_size_max": "1000000000000000",
        //       "lot_size_min": "1",
        //       "lot_size_tick": "1",
        //       "price_max_quote": "1000000000000000",
        //       "price_min_quote": "1",
        //       "default_slippage": 10,
        //       "price_tick_quote": "1",
        //       "lot_size_max_quote": "1000000000000000",
        //       "lot_size_min_quote": "1",
        //       "lot_size_tick_quote": "1"
        //   },
        //   "asks": [
        //       {
        //           "price": "15",
        //           "amount": "120",
        //           "quantity": "8"
        //       },
        //       {
        //           "price": "16",
        //           "amount": "48",
        //           "quantity": "3"
        //       },
        //       {
        //           "price": "18",
        //           "amount": "18",
        //           "quantity": "1"
        //       },
        //       {
        //           "price": "19",
        //           "amount": "247",
        //           "quantity": "13"
        //       }
        //   ],
        //   "bids": [
        //       {
        //           "price": "12",
        //           "amount": "132",
        //           "quantity": "11"
        //       },
        //       {
        //           "price": "11",
        //           "amount": "352",
        //           "quantity": "32"
        //       },
        //       {
        //           "price": "10",
        //           "amount": "330",
        //           "quantity": "33"
        //       }
        //   ],
        //   "updateId": "1",
        //   "timeStart": "2021-02-01T06:10:48.846Z",
        //   "makerFee": 200,
        //   "takerFee": 200,
        //   "baseCurrency.id": 2,
        //   "baseCurrency.symbol": "eth",
        //   "baseCurrency.decimals": 18,
        //   "quoteCurrency.id": 9,
        //   "quoteCurrency.symbol": "del",
        //   "quoteCurrency.decimals": 18
        // }
        return this.parseTicker(ticker, market);
    }

    async fetchOrderBook(symbol, limit = undefined, params = {}) {
        await this.loadMarkets();
        const market = this.market(symbol);
        const request = {
            'ticker': market['id'],
        };
        const response = await this.publicGetPairTicker(this.extend(request, params));
        const ticker = parseResponse(response, 'pair');
        return this.parseOrderBook(ticker, symbol);
    }

    async fetchOHLCV(symbol, timeframe = '1m', since = undefined, limit = undefined, params = {}) {
        await this.loadMarkets();
        const market = this.market(symbol);
        const request = {
            'pair': market['id'],
            'res': this.timeframes[timeframe],
        }
        if (since !== undefined) {
            request['from'] = since;
        }
        const response = await this.twGetTwHistoryPairRes(this.extend(request, params));
        const ohlcvs = this.parseResponse(response, 'data').map((i) => Object.values(i));
        return this.parseOHLCVs(ohlcvs, market, timeframe, since, limit);
    }

    parseOrder(order, market = undefined) {
        const id = parseInt(this.safeNumber(order, 'id'));
        const clientOrderId = this.safeString(order, 'orderCid');
        const timestamp = this.safeNumber(order, 'timestamp');
        const datetime = this.iso8601(timestamp);
        let status = undefined;
        const orderStatus = this.safeString(order, 'status');
        if (orderStatus === 'created' || orderStatus === 'executing') {
            status = 'open';
        } else if (orderStatus === 'cancelled') {
            status = 'canceled';
        } else if (orderStatus === 'accepted' || orderStatus === 'rejected') {
            status = 'closed';
        } else {
            status = 'expired';
        }
        const marketId = this.safeStringUpper(order, 'pair');
        const symbol = this.safeSymbol(marketId, market, '_');
        const type = this.safeString(order, 'type');
        const side = this.safeString(order, 'side');
        const price = parseFloat(this.safeNumber(order, 'price'));
        const amount = this.safeNumber(order, 'quantity');
        let fee = undefined;
        const orderFee = this.safeValue(order, 'fee');
        if (orderFee !== undefined) {
            fee = {
                'currency': this.safeCurrencyCode(orderFee, 'symbol'),
                'cost': this.safeNumber(orderFee, 'amount'),
            }
        }
        return this.safeOrder({
            'info': order,
            'id': id,
            'clientOrderId': clientOrderId,
            'timestamp': timestamp,
            'datetime': datetime,
            'lastTradeTimestamp': undefined,
            'status': status,
            'symbol': symbol,
            'type': type,
            'timeInForce': undefined,
            'side': side,
            'price': price,
            'average': undefined,
            'amount': amount,
            'filled': undefined,
            'remaining': undefined,
            'cost': undefined,
            'trades': undefined,
            'fee': fee,
        })
    }

    async fetchOrder(id, symbol = undefined, params = {}) {
        if (id === undefined) {
            throw new ArgumentsRequired('fetchOrder() requires a id argument');
        }
        const request = {
            'id': parseInt(id),
        };
        const response = await this.privateGetOrderId(this.extend(request, params));
        const order = this.parseResponse(response);
        // {
        //   "id": 215029,
        //   "orderId": "2166",
        //   "userId": 4,
        //   "pair": "eth_usdt",
        //   "pairId": 3,
        //   "quantity": 1000000000000000000,
        //   "price": 19000000,
        //   "fee": null,
        //   "orderCid": "1625747606351",
        //   "executed": 0,
        //   "expires": null,
        //   "baseDecimals": 18,
        //   "quoteDecimals": 6,
        //   "timestamp": 1625747606,
        //   "status": "accepted",
        //   "side": "buy",
        //   "type": "limit"
        // }
        return this.parseOrder(order);
    }

    async fetchOrdersByStatus(status, symbol = undefined, since = undefined, limit = undefined, params = {}) {
        await this.loadMarkets();
        const market = this.market(symbol);
        const request = {
            'limit': limit,
            'type': status,
        }
        const response = await this.privateGetOrdersByUser(this.extend(request, params));
        const orders = this.parseResponse(response, 'orders');
        return this.parseOrders(orders, market, since, limit);
    }

    async fetchOpenOrders(symbol = undefined, since = undefined, limit = undefined, params = {}) {
        return await this.fetchOrdersByStatus('active', symbol, since, limit, params);
    }

    async fetchOrders(symbol = undefined, since = undefined, limit = undefined, params = {}) {
        return await this.fetchOrdersByStatus('all', symbol, since, limit, params);
    }

    async fetchClosedOrders(symbol = undefined, since = undefined, limit = undefined, params = {}) {
        return await this.fetchOrdersByStatus('closed', symbol, since, limit, params);
    }

    async fetchMyTrades(symbol = undefined, since = undefined, limit = undefined, params = {}) {
        await this.loadMarkets();
        const market = this.market(symbol);
        const request = {
            'limit': limit,
            'pairId': market['id'],
        };
        const response = await this.privateGetTradesByUser(this.extend(request, params));
        const trades = this.parseResponse(response, 'trades');
        return this.parseTrades(trades, market, since, limit);
    }

    parseAddress(wallet) {
        const address = this.safeString(wallet, 'address');
        this.checkAddress(address);
        return {
            'currency': code,
            'address': address,
            'tag': undefined,
            'info': wallet,
        };
    }

    async fetchDepositAddress(code, params = {}) {
        await this.loadMarkets();
        const currency = this.currency(code);
        const request = {
            'currencyId': currency['id'],
        };
        const response = await this.privateGetAddressCurrencyId(this.extend(request, params));
        const wallet = this.parseResponse(response, 'wallet');
        // {
        //   "id": "441a8db2-fa2d-4568-963b-e8c872f76777",
        //   "balance": "0",
        //   "lockedBalance": "0",
        //   "balancep2p": "0",
        //   "symbolId": 7,
        //   "symbol": "btc",
        //   "settings": {},
        //   "address": "mo185BSen7ZyELXgnVWmwfNV9NGLaDk56R",
        //   "type": "crypto"
        // }
        return this.parseAddress(wallet);
    }

    parseTransaction(transaction, currency = undefined) {
        const id = this.safeString(transaction, 'id');
        const timestamp = this.safeNumber(transaction, '1617710037274');
        const datetime = this.iso8601(timestamp);
        const addressFrom = this.safeString(transaction, 'sender');
        const addressTo = this.safeString(transaction, 'recipient');
        const type = this.safeString(transaction, 'type');
        const amount = this.safeString(transaction, 'amount');
        const currency = this.safeValue(transaction, 'currency');
        const currencyId = this.safeString(currency, 'symbol');
        const code = this.safeCurrencyCode(currencyId, currency);
        let status = undefined;
        const txStatus = this.safeNumber(transaction, 'status');
        if (txStatus === 1) {
            status = 'ok';
        }
        if (txStatus === -1) {
            status = 'failed';
        }
        if (txStatus === 2 || txStatus === 3) {
            status = 'pending';
        }
        return {
            'info': transaction,
            'id': id,
            'txid': undefined,
            'timestamp': timestamp,
            'datetime': datetime,
            'addressFrom': addressFrom,
            'address': addressFrom,
            'addressTo': addressTo,
            'tagFrom': undefined,
            'tag': undefined,
            'tagTo': undefined,
            'type': type,
            'amount': amount,
            'currency': code,
            'status': status,
            'updated': undefined,
            'comment': undefined,
            'fee': undefined,
        }
    }

    async fetchTransactions(code = undefined, since = undefined, limit = undefined, params = {}) {
        await this.loadMarkets();
        const request = {
            'limit': limit
        };
        let currency = undefined;
        if (code !== undefined) {
            currency = this.currenc(code);
            request['currency'] = currency['id'];
        }
        const response = await this.privateGettransactionsByUser(this.extend(request, params));
        const transactions = this.parseResponse(response);
        // {
        //   "id": 0,
        //     "recipient": "string",
        //     "sender": "string",
        //     "userId": 0,
        //     "symbolId": 0,
        //     "status": 0,
        //     "amount": "string",
        //     "reason": "string",
        //     "type": "string",
        //     "params": "string",
        //     "createdAt": "string",
        //     "updatedAt": "string"
        // }
        return this.parseTransactions(transactions, currency, since, limit);
    }

    async fetchBalance(params = {}) {
        await this.loadMarkets();
        const balance = await this.privateGetCcxtBalance(params);
        // {
        //   "info": {
        //   "free": {
        //     "TDEL": 2020.25458446,
        //         "ETH": 11.09262103
        //   },
        //   "used": {
        //     "TDEL": 25,
        //         "ETH": 1.01
        //   },
        //   "total": {
        //     "TDEL": 2045.25458446,
        //         "ETH": 12.10262103
        //   },
        //   "TDEL": {
        //     "free": 2020.25458446,
        //         "used": 25,
        //         "total": 2045.25458446
        //   },
        //   "ETH": {
        //     "free": 11.09262103,
        //         "used": 1.01,
        //         "total": 12.10262103
        //   }
        // },
        //   "free": {
        //   "TDEL": 2020.25458446,
        //       "ETH": 11.09262103
        // },
        //   "used": {
        //   "TDEL": 25,
        //       "ETH": 1.01
        // },
        //   "total": {
        //   "TDEL": 2045.25458446,
        //       "ETH": 12.10262103
        // },
        //   "TDEL": {
        //   "free": 2020.25458446,
        //       "used": 25,
        //       "total": 2045.25458446
        // },
        //   "ETH": {
        //   "free": 11.09262103,
        //       "used": 1.01,
        //       "total": 12.10262103
        // }
        // }
        return this.parseBalance(balance);
    }

    async createOrder (symbol, type, side, amount, price = undefined, params = {}) {
        await this.loadMarkets ();
        const request = {
            'symbol': this.marketId (symbol),
            'side': side,
            'type': type,
            'major': this.amountToPrecision (symbol, amount),
        };
        if (type === 'limit') {
            request['price'] = this.priceToPrecision (symbol, price);
        }
        const res = await this.privatePostCcxtOrder (this.extend (request, params));
        const response = this.parseResponse(res);
        const id = this.safeString (response['payload'], 'id');
        return {
            'info': response,
            'id': id,
        };
    }

    async cancelOrder(id, symbol = undefined, params = {}) {
        await this.loadMarkets();
        const request = {
            'oid': id,
        };
        return await this.privateDeleteOrdersOid(this.extend(request, params));
    }

    async fetchTransactionsByType(type, code = undefined, since = undefined, limit = undefined, params = {}) {
        await this.loadMarkets();
        const request = {
            'limit': limit,
            'type': type,
        };
        let currency = undefined;
        if (code !== undefined) {
            currency = this.currenc(code);
            request['currency'] = currency['id'];
        }
        const response = await this.privateGetTransactionsType(this.extend(request, params));
        const transactions = this.parseResponse(response, 'transactions');
        // {
        //   "id": 29,
        //   "orderId": "d2b05b99-9e03-466b-bdf1-2899e85aaf48",
        //   "withdrawId": "1",
        //   "userId": 2,
        //   "recipient": "0x15e0e3004Ac2Ef7766a3E8747eDf43Cf375426A3",
        //   "sender": "0x6967FdB6870D4257A223c417E859435420D3F732",
        //   "symbolId": 8,
        //   "CommissionId": 1,
        //   "amount": "12000000000000000000",
        //   "params": {},
        //   "reason": "deposit",
        //   "timestamp": 1617710037274,
        //   "status": 3,
        //   "type": "withdraw",
        //   "message": null,
        //   "currency": {
        //       "symbol": "eth",
        //       "decimals": 18,
        //       "blockChain": "Ethereum"
        //   }
        // }
        return this.parseTransactions(transactions, currency, since, limit);
    }

    async fetchDeposits(code = undefined, since = undefined, limit = undefined, params = {}) {
        return this.fetchTransactionsByType('deposit', code, since, limit, params);
    }

    async fetchWithdrawals(code = undefined, since = undefined, limit = undefined, params = {}) {
        return this.fetchTransactionsByType('withdraw', code, since, limit, params);
    }
}