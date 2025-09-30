import  ClientService from "../services/ClientService.js"
import { ApiResponse } from "../utils/apiResponse.js";

export const createClient = async (req, res) => {
    try {
      const userId = req.user.id;
      const {
        clientIdentifier,
        businessName,
        email,
        address,
      } = req.body;
      
      if (!clientIdentifier) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: client identifier is required'
        });
      }
      
      const clientData = {
        clientIdentifier,
        businessName,
        email,
        address
      };
      
      const client = await ClientService.createClient(userId, clientData);
      
      return ApiResponse.created(res, {
        success: true,
        message: 'Client created successfully',
        data: { client }
      })
      
    } catch (error) {
        console.log('error creating client', error);
        return ApiResponse.error(res, error.message || 'error creating client', error.response?.data)
    }
  }

export const getClients = async (req, res) => {
    try {
      const userId = req.user.id;
      const {
        page,
        limit,
        search,
        isActive,
        hasOverdueInvoices,
        sortBy,
        sortOrder
      } = req.query;
      
      const result = await ClientService.getClients(userId, {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 20,
        search,
        isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
        hasOverdueInvoices: hasOverdueInvoices === 'true',
        sortBy,
        sortOrder
      });
      
        return ApiResponse.success(res, result)
      
    } catch (error) {
        return ApiResponse.serverError(res, error.message || "Error occured while getting clients. Try again!")
    }
  }
  
export const getClient = async (req, res) => {
    try {
      const userId = req.user.id;
      const clientId = parseInt(req.params.clientId);
      
      const client = await ClientService.getClientDetails(clientId, userId);
      
      return ApiResponse.success(res, client)
      
    } catch (error) {
        return ApiResponse.error(res, error.message || "Error getting client. Try Again", error.response?.data)
    }
  }
  
export const getClientInvoices = async (req, res) => {
    try {
      const userId = req.user.id;
      const clientId = parseInt(req.params.clientId);
      const {
        page,
        limit,
        status,
        startDate,
        endDate,
        sortBy,
        sortOrder
      } = req.query;
      
      const result = await ClientService.getClientInvoices(clientId, userId, {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 20,
        status,
        startDate,
        endDate,
        sortBy,
        sortOrder
      });

      return ApiResponse.success(res, result)

    } catch (error) {
        return ApiResponse.badRequest(res, error.message, error.response?.data)
    }
  }
  
export const  updateClient = async (req, res) => {
    try {
      const userId = req.user.id;
      const clientId = parseInt(req.params.clientId);
      const updateData = req.body;
      
      const client = await ClientService.updateClient(clientId, userId, updateData);
      
      return ApiResponse.success(res, {
        message: 'Client updated successfully',
        client
      })
      
    } catch (error) {
        return ApiResponse.error(res, error.message || 'Error updating Client', error.response?.data)
    }
  }

export const searchPotentialClients = async (req, res) => {
    try {
      const userId = req.user.id;
      const searchTerm = req.query.query;
      
      if (!searchTerm) {
        return ApiResponse.error(res, 'Search term is required')
      }
      
      const users = await ClientService.searchPotentialClients(userId, searchTerm);
      
        return ApiResponse.success(res, users)
      
    } catch (error) {
        return ApiResponse.serverError(res, error.message || 'Error fetching potential clients', error.response?.data)
    }
  }
  
export const deactivateClient = async (req, res) => {
    try {
      const userId = req.user.id;
      const clientId = parseInt(req.params.clientId);

      const client = await ClientService.deactivateClient(clientId, userId);

      return ApiResponse.success(res, {
        message: 'Client deactivated successfully',
        client
      })
      
    } catch (error) {
        return ApiResponse.error(res, error.message || 'failed to deactivate client', error.response?.data)
    }
  }
  
export const reactivateClient = async (req, res) => {
    try {
      const userId = req.user.id;
      const clientId = parseInt(req.params.clientId);
      
      const client = await ClientService.reactivateClient(clientId, userId);
      
      return ApiResponse.success(res, {
        message: 'Client reactivated successfully',
        client
      })
      
    } catch (error) {
        return ApiResponse.error(res, error.message || 'Failed to reactivate client', error.response?.data)
    }
  }