import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

class ConversionService {
  constructor() {
    if (this.constructor === ConversionService) {
      throw new Error("Abstract classes can't be instantiated.");
    }
  }

  async convert(amount, fromCurrency, toCurrency) {
    throw new Error('Method "convert()" must be implemented.');
  }
}

class CoinMarketCapService extends ConversionService {
  constructor() {
    super();
    this.apiUrl = 'https://pro-api.coinmarketcap.com/v2/tools/price-conversion';
    this.apiKey = process.env.CMC_API_KEY;
  }

  async convert(amount, fromCurrency, toCurrency) {
    const response = await axios.get(this.apiUrl, {
      headers: {
        'X-CMC_PRO_API_KEY': this.apiKey,
        'Accept': 'application/json',
      },
      params: { amount, symbol: fromCurrency, convert: toCurrency },
    });

    const conversionData = response.data.data?.[0];
    const quote = conversionData?.quote?.[toCurrency];

    if (!quote) {
      throw new Error(`Unable to get quote for ${toCurrency}`);
    }

    return {
      amount,
      fromCurrency,
      toCurrency,
      convertedAmount: quote.price,
      lastUpdated: quote.last_updated,
      provider: 'CoinMarketCap'
    };
  }
}

class CoinGeckoService extends ConversionService {
  constructor() {
    super();
    this.apiUrl = 'https://api.coingecko.com/api/v3/simple/price';
  }

  async convert(amount, fromCurrency, toCurrency) {
    const cryptoId = this.getCoinGeckoId(fromCurrency);
    const response = await axios.get(this.apiUrl, {
      params: {
        ids: cryptoId,
        vs_currencies: toCurrency.toLowerCase(),
      },
    });

    const rate = response.data[cryptoId]?.[toCurrency.toLowerCase()];
    if (!rate) {
      throw new Error(`Unable to get rate for ${fromCurrency} to ${toCurrency}`);
    }

    return {
      amount,
      fromCurrency,
      toCurrency,
      convertedAmount: amount * rate,
      lastUpdated: new Date().toISOString(), // CoinGecko doesn't provide this
      provider: 'CoinGecko'
    };
  }

  getCoinGeckoId(currency) {
    const mapping = {
      USDT: 'tether',
      USDC: 'usd-coin'
    };
    return mapping[currency] || currency.toLowerCase();
  }
}

class BinanceP2PService extends ConversionService {
  constructor() {
    super();
    this.apiUrl = 'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search';
  }

  async convert(amount, fromCurrency, toCurrency) {
    if (toCurrency !== 'NGN' && fromCurrency !== 'NGN') {
      throw new Error('Binance P2P only supports NGN conversions');
    }

    const tradeType = fromCurrency === 'NGN' ? 'SELL' : 'BUY';
    const asset = fromCurrency === 'NGN' ? toCurrency : fromCurrency;

    const response = await axios.post(this.apiUrl, {
      asset,
      fiat: 'NGN',
      tradeType,
      page: 1,
      rows: 1
    });

    const bestOffer = response.data.data[0]?.adv;
    if (!bestOffer) {
      throw new Error('No available offers found');
    }

    const rate = parseFloat(bestOffer.price);
    const convertedAmount = fromCurrency === 'NGN' 
      ? amount / rate 
      : amount * rate;

    return {
      amount,
      fromCurrency,
      toCurrency,
      convertedAmount,
      lastUpdated: new Date().toISOString(),
      provider: 'Binance P2P'
    };
  }
}

export default class ConversionProvider {
  constructor() {
    this.providers = {
      primary: new CoinMarketCapService(),
      fallback: new CoinGeckoService(),
      nairaSpecial: new BinanceP2PService()
    };
  }

  async convert(amount, fromCurrency, toCurrency) {
    if (toCurrency === 'NGN' || fromCurrency === 'NGN') {
      try {
        return await this.providers.nairaSpecial.convert(amount, fromCurrency, toCurrency);
      } catch (error) {
        console.warn(`Binance P2P failed: ${error.message}`);
      }
    }

    try {
      return await this.providers.primary.convert(amount, fromCurrency, toCurrency);
    } catch (error) {
      console.warn(`Primary provider failed: ${error.message}`);
      
      try {
        return await this.providers.fallback.convert(amount, fromCurrency, toCurrency);
      } catch (fallbackError) {
        throw new Error(`All conversion providers failed: ${fallbackError.message}`);
      }
    }
  }
}