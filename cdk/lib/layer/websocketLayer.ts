import { Construct } from '@aws-cdk/cdk';
import { ResourceAwareConstruct, IParameterAwareProps } from './../resourceawarestack'

import Lambda = require('@aws-cdk/aws-lambda');
import IAM = require('@aws-cdk/aws-iam');

import { Table } from '@aws-cdk/aws-dynamodb';

const path = require('path');

const lambdasLocation = path.join(__dirname,'..','..','lambdas');

export class WebSocketLayer extends ResourceAwareConstruct {
    
    private webSocketConnectFunction: Lambda.Function;
    public getWebSocketFunctionArn() {
        return this.webSocketConnectFunction.functionArn;
    }
    public getWebSocketFunctionRef() : Lambda.Function {
        return this.webSocketConnectFunction;
    }

    private webSocketSynchronizeFunction: Lambda.Function;
    public getWebSocketSynchronizeFunctionArn() {
        return this.webSocketSynchronizeFunction.functionArn;
    }
    public getWebSocketSynchronizeFunctionRef() : Lambda.Function {
        return this.webSocketSynchronizeFunction;
    }

    private webSocketDisconnectFunction: Lambda.Function;
    public getWebSocketDisconnectFunctionArn() {
        return this.webSocketDisconnectFunction.functionArn;
    }
    public getWebSocketDisconnectFunctionRef() : Lambda.Function {
        return this.webSocketDisconnectFunction;
    }

    constructor(parent: Construct, name: string, props: IParameterAwareProps) {
        super(parent, name, props);
        let createdFunction: Lambda.Function | undefined | null = null;
        
        createdFunction = this.getWebSocketConnectFunction();
        if (createdFunction) this.webSocketConnectFunction = createdFunction;
    
        createdFunction = this.getWebSocketSynchronizeFunction();
        if (createdFunction) this.webSocketSynchronizeFunction = createdFunction;

        createdFunction = this.getWebSocketDisconnectFunction();
        if (createdFunction) this.webSocketDisconnectFunction = createdFunction;
    }

    private getWebSocketConnectFunction() {
    /**
     * This function requires access to
     * SystemsManager
     *      process.env.SESSION_PARAMETER = /<getAppRefName>/session
     * DynamoDB Tables
     *      process.env.SESSION_CONTROL_TABLENAME = getAppRefName+'SessionControl' 
     */
        let sessionParameter = { parameterName: '/'+this.properties.getApplicationName().toLocaleLowerCase()+'/session' };
        let sessionControlTable : Table = <Table> this.properties.getParameter('table.sessioncontrol');
        if (sessionParameter && sessionControlTable) {
            let createdFunction: Lambda.Function = 
                new Lambda.Function(this, this.properties.getApplicationName() + 'WebSocketConnect', {
                    runtime: Lambda.Runtime.NodeJS810,
                    handler: 'index.handler',
                    code: Lambda.Code.asset(path.join(lambdasLocation, 'websocketConnect')),
                    environment: {
                        'SESSION_CONTROL_TABLENAME': sessionControlTable,
                        'SESSION_PARAMETER': sessionParameter.parameterName
                    },
                    functionName: this.properties.getApplicationName() + 'WebSocketConnect',
                    description: 'This function stores the connectionID to DynamoDB',
                    memorySize: 128,
                    timeout: 60,
                    role: new IAM.Role(this, this.properties.getApplicationName() + 'WebSocketConnectFn_Role', {
                        roleName: this.properties.getApplicationName() + 'WebSocketConnectFn_Role',
                        assumedBy: new IAM.ServicePrincipal('lambda.amazonaws.com'),
                        managedPolicyArns: ['arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole'],
                        inlinePolicies: {
                            'DynamoDBPermissions':
                                new IAM.PolicyDocument().addStatement(
                                    new IAM.PolicyStatement()
                                        .allow()
                                        .addResource(sessionControlTable.tableArn)
                                        .addAction('dynamodb:UpdateItem')
                                ),
                            'SystemsManagerPermissions':
                                    new IAM.PolicyDocument().addStatement(
                                        new IAM.PolicyStatement()
                                        .allow()
                                        .addResource('arn:aws:ssm:'+this.properties.region+':'+this.properties.accountId+':parameter'+sessionParameter.parameterName)
                                        .addAction('ssm:GetParameter')
                                        .addAction('ssm:GetParameters')
                                )
                        }  
                    })
                });
            return createdFunction;
        }
        else return undefined;
    }


    private getWebSocketSynchronizeFunction() {
    /**
     * This function requires access to
     * SystemsManager
     *      process.env.SESSION_PARAMETER = /<getAppRefName>/session
     * DynamoDB Tables
     *      process.env.SESSION_CONTROL_TABLENAME = getAppRefName+'SessionControl' 
     */
        let sessionParameter = { parameterName: '/'+this.properties.getApplicationName().toLocaleLowerCase()+'/session' };
        let sessionControlTable : Table = <Table> this.properties.getParameter('table.sessioncontrol');
        if (sessionParameter && sessionControlTable) {
            let createdFunction: Lambda.Function = 
                new Lambda.Function(this, this.properties.getApplicationName() + 'WebSocketSynchronizeStart', {
                    runtime: Lambda.Runtime.NodeJS810,
                    handler: 'index.handler',
                    code: Lambda.Code.asset(path.join(lambdasLocation, 'synchronousStart')),
                    environment: {
                        'SESSION_CONTROL_TABLENAME': sessionControlTable,
                        'SESSION_PARAMETER': sessionParameter.parameterName
                    },
                    functionName: this.properties.getApplicationName() + 'WebSocketSynchronizeStart',
                    description: 'This function invokes the WebSocket to start the AAA Game',
                    memorySize: 128,
                    timeout: 60,
                    role: new IAM.Role(this, this.properties.getApplicationName() + 'WebSocketSynchronizeStartFn_Role', {
                        roleName: this.properties.getApplicationName() + 'WebSocketSynchronizeStartFn_Role',
                        assumedBy: new IAM.ServicePrincipal('lambda.amazonaws.com'),
                        managedPolicyArns: ['arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole'],
                        inlinePolicies: {
                            'DynamoDBPermissions':
                                new IAM.PolicyDocument().addStatement(
                                    new IAM.PolicyStatement()
                                        .allow()
                                        .addResource(sessionControlTable.tableArn)
                                        .addAction('dynamodb:UpdateItem')
                                        .addAction('dynamodb:GetItem')
                                ),
                            'SystemsManagerPermissions':
                                    new IAM.PolicyDocument().addStatement(
                                        new IAM.PolicyStatement()
                                        .allow()
                                        .addResource('arn:aws:ssm:'+this.properties.region+':'+this.properties.accountId+':parameter'+sessionParameter.parameterName)
                                        .addAction('ssm:GetParameter')
                                        .addAction('ssm:GetParameters')
                                        .addAction('ssm:PutParameter')
                                )
                        }  
                    })
                });
            return createdFunction;
        }
        else return undefined;
    }


    private getWebSocketDisconnectFunction() {
    /**
     * This function requires access to
     * SystemsManager
     *      process.env.SESSION_PARAMETER = /<getAppRefName>/session
     * DynamoDB Tables
     *      process.env.SESSION_CONTROL_TABLENAME = getAppRefName+'SessionControl' 
     */
        let sessionParameter = { parameterName: '/'+this.properties.getApplicationName().toLocaleLowerCase()+'/session' };
        let sessionControlTable : Table = <Table> this.properties.getParameter('table.sessioncontrol');
        if (sessionParameter && sessionControlTable) {
            let createdFunction: Lambda.Function = 
                new Lambda.Function(this, this.properties.getApplicationName() + 'WebSocketDisconnect', {
                    runtime: Lambda.Runtime.NodeJS810,
                    handler: 'index.handler',
                    code: Lambda.Code.asset(path.join(lambdasLocation, 'websocketDisconnect')),
                    environment: {
                        'SESSION_CONTROL_TABLENAME': sessionControlTable,
                        'SESSION_PARAMETER': sessionParameter.parameterName
                    },
                    functionName: this.properties.getApplicationName() + 'WebSocketDisconnect',
                    description: 'This function deletes the connectionID to DynamoDB',
                    memorySize: 128,
                    timeout: 60,
                    role: new IAM.Role(this, this.properties.getApplicationName() + 'WebSocketDisconnectFn_Role', {
                        roleName: this.properties.getApplicationName() + 'WebSocketDisconnectFn_Role',
                        assumedBy: new IAM.ServicePrincipal('lambda.amazonaws.com'),
                        managedPolicyArns: ['arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole'],
                        inlinePolicies: {
                            'DynamoDBPermissions':
                                new IAM.PolicyDocument().addStatement(
                                    new IAM.PolicyStatement()
                                        .allow()
                                        .addResource(sessionControlTable.tableArn)
                                        .addAction('dynamodb:UpdateItem')
                                        .addAction('dynamodb:GetItems')
                                        .addAction('dynamodb:GetItem')
                                ),
                            'SystemsManagerPermissions':
                                    new IAM.PolicyDocument().addStatement(
                                        new IAM.PolicyStatement()
                                        .allow()
                                        .addResource('arn:aws:ssm:'+this.properties.region+':'+this.properties.accountId+':parameter'+sessionParameter.parameterName)
                                        .addAction('ssm:GetParameter')
                                        .addAction('ssm:GetParameters')
                                )
                        }  
                    })
                });
            return createdFunction;
        }
        else return undefined;
    }
    
}