/**
 * Purpose of this function is to delete any stale
 * connectionIDs from closed websockets
 */

'use strict';

const AWS = require('aws-sdk');
const DynamoDB = new AWS.DynamoDB.DocumentClient();
const SSM = new AWS.SSM();
exports.handler = (event, context, callback) => {
    // Get table nmame from ssm

    // Delete connectionID from the table
}
