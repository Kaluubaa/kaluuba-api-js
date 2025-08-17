import { ApiResponse } from "../utils/apiResponse.js";
import ConversionProvider from "../services/ConversionService.js";

const CACHE_TTL = 30000; // 30 seconds cache
const cache = new Map();
const conversionService = new ConversionProvider();

export const convert = async (req, res) => {
  const { amount, fromCurrency, toCurrency } = req.body;
  const cacheKey = `${amount}-${fromCurrency}-${toCurrency}`;

  if (!amount || isNaN(amount)) {
    return ApiResponse.badRequest(res, 'Valid amount is required');
  }

  if (!fromCurrency || !toCurrency) {
    return ApiResponse.badRequest(res, 'Both fromCurrency and toCurrency are required', {
      supportedCryptos: ['USDT', 'USDC']
    });
  }

  // Check cache
  if (cache.has(cacheKey)) {
    const { data, timestamp } = cache.get(cacheKey);
    if (Date.now() - timestamp < CACHE_TTL) {
      return ApiResponse.success(res, { ...data, cached: true });
    }
  }

  try {
    const result = await conversionService.convert(amount, fromCurrency, toCurrency);
    
    cache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });

    return ApiResponse.success(res, result);
  } catch (error) {
    console.error('Conversion error:', error.message);
    return ApiResponse.serverError(res, error.message, error.response?.data);
  }
};