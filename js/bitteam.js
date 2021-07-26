'use strict'

// ----------------------------------------------------------------------------

const Exchange = require ('./base/Exchange');
const { AccountSuspended, BadRequest, ExchangeError, ExchangeNotAvailable, AuthenticationError, InsufficientFunds, InvalidOrder, OnMaintenance, OrderNotFound, PermissionDenied, RateLimitExceeded } = require ('./base/errors');
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
      },
      'urls': {},
      'api': {
        'public': {
          'get': [
            'currencies',
            'pairs',
            'trades',
          ]
        }
      }
    })
  }

  parseResponse (response, field) {
    const data = this.safeValue (response, 'result');
    const parsedResponse = this.safeValue (data, field);
    return parsedResponse;
  }

  async fetchCurrencies (params = {}) {
    const response = await this.publicGetCurrencies (params);
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
      const id = this.safeString(entity, 'id');
      const code = this.safeString(entity, 'symbol');
      const name = this.safeString(entity, 'title');
      const active = this.safeValue(entity, 'active');
      const tx = this.safaValue(entity, 'txLimits');
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
      });
    }
    return result;
  }

  convertMarket (market) {
    const id = market.name.replace('_', '');
    const symbol = market.fullName.replace(' ', '/');
    const base = market.fullName.split(' ')[0];
    const quote = market.fullName.split(' ')[1];
    const baseId = base.toLowerCase();
    const quoteId = quote.toLowerCase();
    const active = this.safeValue(market, 'active');
    const taker = this.safeNumber(market, 'takerFee');
    const maker = this.safeNumber(market, 'makerFee');
    const precision = {
      'base': this.safeNumber(market, 'baseStep'),
      'quote': this.safeNumber(market, 'quoteStep'),
    };
    const limits = {
      'price': {
        'min': market.settings.price_min,
        'max': market.settings.price_max,
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

  async fetchMarkets (params = {}) {
    const response = await this.publicGetPairs (params);
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
    for (let i = 0; i < markets.length; i ++) {
      result.push(this.convertMarket(markets[i]));
    }
    return result;
  }

  parseTrade (trade, market = undefined) {
    const id = this.safeString (trade, 'id');
    const timestamp = this.safeNumber (trade, 'timestamp');
    const marketId = this.safeString (trade, 'pair');
    market = this.safeMarket (marketId, market, '-');
    const side = this.safeString (trade, 'side');
    const isMaker = this.safeValue (trade, 'isBuyerMaker');
    const takerOrMaker = isMaker ? 'maker' : 'taker';
    const price = this.safeNumber (trade, 'price');
    const amount = this.safeNumber (trade, 'quantity');
    const cost = price * amount;
    return {
      'info': trade,
      'id': id,
      'timestamp': timestamp,
      'datetime': this.iso8601 (timestamp),
      'symbol': market['symbol'],
      'side': side,
      'takerOrMaker': takerOrMaker,
      'price': price,
      'amount': amount,
      'cost': cost,
    }
  }

  async fetchTrades (symbol, since = undefined, limit = 10, params = {}) {
    await this.loadMarkets ();
    const market = this.market (symbol);
    const request = {
      'limit': limit,
      'pairId': market['id'],
    }
    const response = await this.publicGetTrades (this.extend (request, params));
    const trades = this.parseResponse (response, 'trades');
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
    return this.parseTrades (trades, market, since, limit);
  }
}