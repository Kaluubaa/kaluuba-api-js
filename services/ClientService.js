'use strict';
import db from '../models/index.js';
const { Client, User, Invoice } = db;
import { Op } from 'sequelize';

class ClientService {
  static async createClient(userId, clientData) {
    try {
      const existingClient = await Client.findOne({
        where: {
          userId,
          clientIdentifier: clientData.clientIdentifier
        }
      });
      
      if (existingClient) {
        throw new Error('Client with this identifier already exists');
      }
      
      // Check if clientIdentifier corresponds to a registered user
      let clientUserId = null;
      const registeredUser = await User.findOne({
        where: {
          [Op.or]: [
            { email: clientData.clientIdentifier },
            { username: clientData.clientIdentifier },
            { walletAddress: clientData.clientIdentifier }
          ]
        }
      });
      
      if (registeredUser) {
        clientUserId = registeredUser.id;
        
        if (!clientData.email) {
          clientData.email = registeredUser.email;
        }
      }
      
      const client = await Client.create({
        ...clientData,
        userId,
        clientUserId,
        isActive: true
      });
      
      return await this.getClientDetails(client.id, userId);
    } catch (error) {
      throw new Error(`Failed to create client: ${error.message}`);
    }
  }
  
  static async getClientDetails(clientId, userId) {
    const client = await Client.findOne({
      where: { 
        id: clientId, 
        userId 
      },
      include: [
        {
          model: User,
          as: 'registeredUser',
          attributes: ['id', 'username', 'email', 'walletAddress', 'smartAccountAddress']
        },
        {
          model: Invoice,
          as: 'invoices',
          attributes: ['id', 'invoiceNumber', 'title', 'status', 'totalAmount', 'dueDate', 'createdAt'],
          order: [['createdAt', 'DESC']],
          limit: 10
        }
      ]
    });
    
    if (!client) {
      throw new Error('Client not found or access denied');
    }
    
    return client;
  }
  
  static async updateClient(clientId, userId, updateData) {
    const client = await Client.findOne({
      where: { 
        id: clientId, 
        userId 
      }
    });
    
    if (!client) {
      throw new Error('Client not found or access denied');
    }
    
    // If clientIdentifier is being updated, check for conflicts
    if (updateData.clientIdentifier && updateData.clientIdentifier !== client.clientIdentifier) {
      const existingClient = await Client.findOne({
        where: {
          userId,
          clientIdentifier: updateData.clientIdentifier,
          id: { [Op.ne]: clientId }
        }
      });
      
      if (existingClient) {
        throw new Error('Another client with this identifier already exists');
      }
      
      // Check if new identifier corresponds to a registered user
      const registeredUser = await User.findOne({
        where: {
          [Op.or]: [
            { email: updateData.clientIdentifier },
            { username: updateData.clientIdentifier },
            { walletAddress: updateData.clientIdentifier }
          ]
        }
      });
      
      updateData.clientUserId = registeredUser ? registeredUser.id : null;
    }
    
    await client.update(updateData);
    return await this.getClientDetails(clientId, userId);
  }
  
  static async getClients(userId, options = {}) {
    const {
      page = 1,
      limit = 20,
      search,
      isActive,
      hasOverdueInvoices,
      sortBy = 'createdAt',
      sortOrder = 'DESC'
    } = options;
    
    const where = { userId };
    const include = [
      {
        model: User,
        as: 'registeredUser',
        attributes: ['id', 'username', 'email'],
        required: false
      }
    ];
    
    if (typeof isActive === 'boolean') {
      where.isActive = isActive;
    }
    
    if (search) {
      where[Op.or] = [
        { businessName: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
        { clientIdentifier: { [Op.iLike]: `%${search}%` } }
      ];
    }
    
    let havingCondition = null;
    if (hasOverdueInvoices) {
      include.push({
        model: Invoice,
        as: 'invoices',
        attributes: [
          [sequelize.fn('COUNT', 
            sequelize.literal(`CASE WHEN "invoices"."status" NOT IN ('paid', 'cancelled') AND "invoices"."dueDate" < NOW() THEN 1 END`)
          ), 'overdueCount']
        ],
        required: false
      });
      
      havingCondition = sequelize.having(
        sequelize.fn('COUNT', 
          sequelize.literal(`CASE WHEN "invoices"."status" NOT IN ('paid', 'cancelled') AND "invoices"."dueDate" < NOW() THEN 1 END`)
        ), '>', 0
      );
    }
    
    const queryOptions = {
      where,
      include,
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
      order: [[sortBy, sortOrder.toUpperCase()]],
      distinct: true
    };
    
    if (hasOverdueInvoices) {
      queryOptions.group = ['Client.id', 'registeredUser.id'];
      queryOptions.having = havingCondition;
    }
    
    const { rows, count } = await Client.findAndCountAll(queryOptions);
    
    // Get invoice stats for each client
    const clientsWithStats = await Promise.all(
      rows.map(async (client) => {
        const invoiceStats = await this.getClientInvoiceStats(client.id);
        return {
          ...client.toJSON(),
          invoiceStats
        };
      })
    );
    
    return {
      clients: clientsWithStats,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: Array.isArray(count) ? count.length : count,
        pages: Math.ceil((Array.isArray(count) ? count.length : count) / limit)
      }
    };
  }
  
  static async getClientInvoiceStats(clientId) {
    const [totalInvoices, paidInvoices, overdueInvoices, totalBilled, totalPaid] = await Promise.all([
      Invoice.count({ where: { clientId } }),
      Invoice.count({ where: { clientId, status: 'paid' } }),
      Invoice.count({ 
        where: { 
          clientId,
          status: { [Op.notIn]: ['paid', 'cancelled'] },
          dueDate: { [Op.lt]: new Date() }
        } 
      }),
      Invoice.sum('totalAmount', { where: { clientId } }),
      Invoice.sum('totalAmount', { where: { clientId, status: 'paid' } })
    ]);
    
    return {
      totalInvoices,
      paidInvoices,
      overdueInvoices,
      totalBilled: totalBilled || 0,
      totalPaid: totalPaid || 0,
      outstandingAmount: (totalBilled || 0) - (totalPaid || 0),
      paymentRate: totalInvoices > 0 ? (paidInvoices / totalInvoices * 100).toFixed(2) : 0
    };
  }
  
  static async getClientInvoices(clientId, userId, options = {}) {
    const {
      page = 1,
      limit = 20,
      status,
      startDate,
      endDate,
      sortBy = 'createdAt',
      sortOrder = 'DESC'
    } = options;
    
    const client = await Client.findOne({
      where: { id: clientId, userId }
    });
    
    if (!client) {
      throw new Error('Client not found or access denied');
    }
    
    const where = { clientId };
    
    if (status) {
      where.status = status;
    }
    
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt[Op.gte] = new Date(startDate);
      if (endDate) where.createdAt[Op.lte] = new Date(endDate);
    }
    
    const { rows, count } = await Invoice.findAndCountAll({
      where,
      include: [
        {
          model: Client,
          as: 'client',
          attributes: ['id', 'contactName', 'businesName']
        }
      ],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
      order: [[sortBy, sortOrder.toUpperCase()]]
    });
    
    return {
      client,
      invoices: rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / limit)
      }
    };
  }
  
  static async deactivateClient(clientId, userId) {
    const client = await Client.findOne({
      where: { id: clientId, userId }
    });
    
    if (!client) {
      throw new Error('Client not found or access denied');
    }
    
    const pendingInvoices = await Invoice.count({
      where: {
        clientId,
        status: { [Op.notIn]: ['paid', 'cancelled'] }
      }
    });
    
    if (pendingInvoices > 0) {
      throw new Error(`Cannot deactivate client with ${pendingInvoices} pending invoice(s)`);
    }
    
    await client.update({ isActive: false });
    return client;
  }
  
  static async reactivateClient(clientId, userId) {
    const client = await Client.findOne({
      where: { id: clientId, userId }
    });
    
    if (!client) {
      throw new Error('Client not found or access denied');
    }
    
    await client.update({ isActive: true });
    return client;
  }
  
  static async searchPotentialClients(userId, searchTerm) {
    if (!searchTerm || searchTerm.length < 2) {
      return [];
    }
    
    const users = await User.findAll({
      where: {
        id: { [Op.ne]: userId }, // Exclude the current user
        [Op.or]: [
          { email: { [Op.iLike]: `%${searchTerm}%` } },
          { username: { [Op.iLike]: `%${searchTerm}%` } }
        ]
      },
      attributes: ['id', 'username', 'email', 'walletAddress'],
      limit: 10
    });
    
    const existingClients = await Client.findAll({
      where: {
        userId,
        clientUserId: { [Op.in]: users.map(u => u.id) }
      },
      attributes: ['clientUserId']
    });
    
    const existingClientIds = new Set(existingClients.map(c => c.clientUserId));
    
    return users
      .filter(user => !existingClientIds.has(user.id))
      .map(user => ({
        id: user.id,
        identifier: user.email,
        displayName: user.username,
        fullName: `${user.firstname || ''} ${user.lastname || ''}`.trim(),
        email: user.email,
        walletAddress: user.walletAddress,
        isRegisteredUser: true
      }));
  }
}

export default ClientService;