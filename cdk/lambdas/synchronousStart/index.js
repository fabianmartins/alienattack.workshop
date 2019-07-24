/**
 * Purpose of this function is to post to every connection
 * and let them know the game has started
 */

'use strict';

const AWS = require('aws-sdk');
const DynamoDB = new AWS.DynamoDB.DocumentClient();
const SSM = new AWS.SSM();
const APIGatewayManagement = new AWS.ApiGatewayManagementApi({apiVersion: '2018-11-29'});

const readSessionFromSSM = function (callback) {
    let param = {
        "Name": process.env.SESSION_PARAMETER
    };
    SSM.getParameter(param,
        function (error, sessionParamResponse) {
            if (error) {
                let errorMessage = "Error reading from SSM";
                console.log(errorMessage);
                console.log(error);
                let responseError = new Error(errorMessage);
                responseError.code = "ErrorReadingSSM";
                responseError.details = error;
                callback(responseError,500);
            } else {
                let sessionData = null;
                try {
                    sessionData = JSON.parse(sessionParamResponse.Parameter.Value);
                    callback(null, sessionData);
                } catch (error) {
                    let errorMessage = "Error parsing session data from SSM";
                    console.log(errorMessage);
                    console.log(error);
                    let responseError = new Error(errorMessage);
                    responseError.code = "ErrorReadingFromSSM";
                    responseError.details = error;
                    console.log(sessionData);
                    callback(responseError, 500);
                }
            }
        }
    );
};

const readConnectionsFromDynamo = (session, callback) => {
    let tableName = process.env.SESSION_CONTROL_TABLENAME;
    console.log(session);
    let params = {
        TableName: tableName,
        Key: {'SessionId': session.SessionId},
        ConsistentRead: true
    };
    DynamoDB.get(params, (err, data) => {
        if (err) {
            console.log(err);
            callback(new Error("Error reading connections "));
        } else {
            console.log(data);
            let connections = data.Item.connections.map((elem) => {return elem;});
            console.log(connections);
            callback(null, connections);
        }
    });
}

const dispatchToConnections = (connections, callback) => {
    console.log(APIGatewayManagement);
    const posts = connections.map(async (connection) => {
        try {
            console.log('posting to connection: ', connection);
            await APIGatewayManagement.postToConnection({
                ConnectionId: connection,
                Data: 'start'
            }).promise();
        } catch (e) {
            console.log(e);
            if (e.statusCode == 410) {
                // delete the connection
            }
        }
    });
    Promise.all(posts);
    console.log('Sent to all connections')
    callback(null, 'success');
}
    

exports.handler = (event, context, callback) => {
    APIGatewayManagement.endpoint = event.requestContext.domainName + '/' + event.requestContext.stage;
    let response = null;
    readSessionFromSSM((err, session) => {
        if (err) {
            response = {
                isBase64Encoded: false,
                statusCode: err.errorCode,
                body: JSON.stringify({'errorMessage':err.errorMessage, 'errorCode': err.errorCode})
            };
            callback(null, err);
        } else {
            if (!session || typeof session != 'string' || session.trim() == '') {
                response = {
                    isBase64Encoded: false,
                    statusCode: 400,
                    body: JSON.stringify({
                        'errorMessage':'no session available',
                        'errorCode': 400
                    })
                };
                callback(null, response);
            }
            readConnectionsFromDynamo(session, (err, connections) => {
                if (err) {
                    response = {
                        isBase64Encoded: false,
                        statusCode: 400,
                        body: JSON.stringify({
                            'error': err
                        })
                    };
                    callback(null, response);
                } else {
                    if (!connections || connections.length == 0) {
                        response = {
                            isBase64Encoded: false,
                            statusCode: 400,
                            body: JSON.stringify({
                                'errorMessage': 'There are no connections',
                                'errorCode': 400
                            })
                        };
                    }
                    dispatchToConnections(connections, (err,_) => {
                        if (err) {
                            response = {
                                isBase64Encoded: false,
                                statusCode: 400,
                                body: JSON.stringify({
                                    'error': err
                                })
                            };
                            callback(null, response);
                        } else {
                            response = {
                                isBase64Encoded: false,
                                statusCode: 200
                            };
                            callback(null, response);
                        }
                    });
                }
            });
        }
    });
}
