/**
 * Purpose of this function is to write the connectionID of users who open 
 * a websocket connection.
 */

'use strict';

const AWS = require('aws-sdk');
const DynamoDB = new AWS.DynamoDB.DocumentClient();

const recordConnectiontoSession = function(session, connectionId, callback) {
    let tableName = process.env.SESSION_CONTROL_TABLENAME;
    let params = {
        'TableName': tableName,
        'Key': {'SessionId': session},
        'ExpressionAttributeNames': {'#connections': 'connections'},
        'ExpressionAttributeValues': {
            ':connections': [connectionId],
            ':empty_list': []
        },
        'UpdateExpression': 'set #connections = list_append(if_not_exists(#users, :empty_list), :connections)'
    }
    DynamoDB.update(params, (err, data) => {
        if (err) {
            let message = 'Error in placing connectionID';
            callback(new Error(message), 422);
        } else callback(null, ('Success adding connection'));
    });
};

exports.handler = (event, context, callback) => {
    console.log(event);
    // Update table with connectionID
    const { connectionId } = event.requestContext; 
    let response = null;
    let session = null;
    
    // Attempt to parse event
    try {
        session = JSON.parse(event.body).session;
    } catch (conversionError) {
        console.log('Conversion Error')
        response = {
            statusCode: 400,
            isBase64Encoded : false,
            body: JSON.stringify({ "errorMessage" : "Invalid payload for request","errorCode" : 400 })
        };
        callback(null, response);
    }

    // Make sure that the session is valid
    if (!session || typeof session != 'string' || session.trim() == '') {
        response = {
            statusCode: 400,
            isBase64Encoded: false,
            body: JSON.stringify({
                "errorMessage": "Invalid request. Session not provided.",
                "errorCode" : 400
            })
        };
        callback(null, response);
    }

    recordConnectiontoSession(session, connectionId, (err, data) => {
        if (err) {
            response = {
                statusCode: err.statusCode,
                isBase64Encoded: false,
                body: JSON.stringify({
                    "errorMessage": err.errorMessage,
                    "errorCode": err.errorCode
                })
            };
            callback(null, response);
        } else {
            callback(null, {
                statusCode: 200,
                isBase64Encoded: false,
                body: JSON.stringify({
                    "success": true
                })
            })
        }
    });
}
