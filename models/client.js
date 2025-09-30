'use strict';
import {
  Model
} from 'sequelize';

export default (sequelize, DataTypes) => {
  class Client extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Client.belongsTo(models.User, {
        foreignKey: 'userId',
        as: 'owner',
        onDelete: 'CASCADE'
      })

      Client.belongsTo(models.User, {
        foreignKey: 'clientUserId',
        as: 'registeredUser',
        onDelete: 'CASCADE'
      })

      Client.hasMany(models.Invoice, { 
        foreignKey: 'clientId', 
        as: 'invoices' 
      });
    }
  }
  Client.init({
    userId: DataTypes.BIGINT,
    clientUserId: DataTypes.BIGINT,
    clientIdentifier: DataTypes.STRING,
    businesName: DataTypes.STRING,
    contactName: DataTypes.STRING,
    email: DataTypes.STRING,
    address: DataTypes.JSONB,
    isActive: DataTypes.BOOLEAN,
    metadata: DataTypes.JSONB
  }, {
    sequelize,
    modelName: 'Client',
    tableName: 'clients'
  });
  return Client;
};