'use strict'

// ----------------------------------------------------------------------------

const Exchange = require ('./base/Exchange');
const { AccountSuspended, BadRequest, ExchangeError, ExchangeNotAvailable, AuthenticationError, InsufficientFunds, InvalidOrder, OnMaintenance, OrderNotFound, PermissionDenied, RateLimitExceeded } = require ('./base/errors');

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
      },
      'urls': {},
      'api': {
        'public': {
          'get': [
            'currencies'
          ]
        }
      }
    })
  }

  async fetchCurrencies (params = {}) {
    const response = await this.publicGetCurrencies (params);
    const data = this.safeValue (response, 'result');
    const currencies = this.safeValue(data, 'currencies');
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
          }
        }
      })
    }
    return result;
  }
}