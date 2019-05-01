import { Construct } from '@aws-cdk/cdk';
import { ResourceAwareConstruct, IParameterAwareProps } from './../resourceawarestack'

import Lambda = require('@aws-cdk/aws-lambda');
import IAM = require('@aws-cdk/aws-iam');

import SQS = require('@aws-cdk/aws-sqs');
// MISSING PARAMETER  - side effect - uncomment the next line to fix it
// import { CfnParameter } from '@aws-cdk/aws-ssm';
import { Table } from '@aws-cdk/aws-dynamodb';

const path = require('path');

const lambdasLocation = path.join(__dirname,'..','..','lambdas');

export class ProcessingLayer extends ResourceAwareConstruct {

    private allocateFunction: Lambda.Function;
    public getAllocateFunctionArn() {
        return this.allocateFunction.functionArn;
    }
    public getAllocateFunctionRef() : Lambda.Function {
        return this.allocateFunction;
    }

    private deallocateFunction: Lambda.Function;
    public getDeallocateFunctionArn() {
        return this.deallocateFunction.functionArn;;
    }

    private scoreboardFunction : Lambda.Function;
    public getScoreboardFunctionArn() {
        return this.scoreboardFunction.functionArn;
    }
    public getScoreboardFunctionRef() : Lambda.Function {
        return this.scoreboardFunction;
    }

    constructor(parent: Construct, name: string, props: IParameterAwareProps) {
        super(parent, name, props);
        let createdFunction: Lambda.Function | undefined | null = null;

        createdFunction = this.getAllocateGamerFunction();
        if (createdFunction) this.allocateFunction = createdFunction;

        createdFunction = this.getDeallocateGamerFunction();
        if (createdFunction) this.deallocateFunction = createdFunction;

        createdFunction = this.getScoreboardFunction();
        if (createdFunction) this.scoreboardFunction = createdFunction;
        
    }

    private getAllocateGamerFunction() {
        /**
    * This function requires access to 
    * SystemsManager
    *      process.env.SESSION_PARAMETER = /<getAppRefName>/session
    * DynamoDB Tables
    *      process.env.SESSION_CONTROL_TABLENAME = getAppRefName+'SessionControl'
    */
        // MISSING PARAMETER - side effect - remove the next line, uncomment the next one.
        let sessionParameter = { parameterName : '/'+this.properties.getApplicationName().toLocaleLowerCase()+'/session'};
        //let sessionParameter : CfnParameter = <CfnParameter> this.properties.getParameter('parameter.session');
        let sessionControlTable : Table = <Table> this.properties.getParameter('table.sessioncontrol');
        if (sessionParameter && sessionControlTable) {
            let createdFunction: Lambda.Function =
                new Lambda.Function(this, this.properties.getApplicationName() + 'AllocateGamerFn', {
                    runtime: Lambda.Runtime.NodeJS610,
                    handler: 'index.handler',
                    code: Lambda.Code.asset(path.join(lambdasLocation,'allocateGamer')),
                    environment: {
                        'SESSION_CONTROL_TABLENAME': sessionControlTable.tableName,
                        'SESSION_PARAMETER': sessionParameter.parameterName
                    }
                    , functionName: this.properties.getApplicationName() + 'AllocateGamerFn'
                    , description: 'This function supports the allocation of gamers when the game is to start'
                    , memorySize: 128
                    , timeout: 60
                    , role: new IAM.Role(this, this.properties.getApplicationName() + 'AllocateGamerFn_Role', {
                        roleName: this.properties.getApplicationName() + 'AllocateGamerFn_Role'
                        , assumedBy: new IAM.ServicePrincipal('lambda.amazonaws.com')
                        , managedPolicyArns: ['arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole']
                        , inlinePolicies: {
                            'DynamoDBPermissions':
                                new IAM.PolicyDocument().addStatement(
                                    new IAM.PolicyStatement()
                                        .allow()
                                        .addResource(sessionControlTable.tableArn)
                                        .addAction('dynamodb:GetItem')
                                        .addAction('dynamodb:UpdateItem')
                                        .addAction('dynamodb:Scan')
                                        .addAction('dynamodb:Query')
                                ),
                            'SystemsManagerPermissions':
                                new IAM.PolicyDocument().addStatement(
                                    new IAM.PolicyStatement()
                                        .allow()
                                        .addResource('arn:aws:ssm:'+this.properties.region+':'+this.properties.accountId+':parameter'+sessionParameter.parameterName)
                                        .addAction('ssm:GetParameter')
                                        .addAction('ssm:GetParameters')
                                ),
                        }
                    })
                });
            return createdFunction;
        }
        else return undefined;
    }

    private getDeallocateGamerFunction() {
        /**
         * This function requires access to 
         * SystemsManager
         *      process.env.SESSION_PARAMETER = /<getAppRefName>/session
         * DynamoDB Tables
         *      process.env.SESSION_CONTROL_TABLENAME = getAppRefName+'SessionControl'
         */
        // MISSING PARAMETER - side effect - remove the next line, uncomment the next one.
        let sessionParameter = { parameterName : '/'+this.properties.getApplicationName().toLocaleLowerCase()+'/session'};
        //let sessionParameter: CfnParameter = <CfnParameter>  this.properties.getParameter('parameter.session');
        let sessionControlTable: Table | undefined = <Table> this.properties.getParameter('table.sessionControl');
        if (sessionParameter && sessionControlTable) {
            let createdFunction: Lambda.Function =
                new Lambda.Function(this, this.properties.getApplicationName() + 'DeallocateGamerFn', {
                    runtime: Lambda.Runtime.NodeJS610,
                    handler: 'index.handler',
                    code: Lambda.Code.asset(path.join(lambdasLocation,'deallocateGamer')),
                    environment: {
                        'SESSION_CONTROL_TABLENAME': sessionControlTable.tableName,
                        'SESSION_PARAMETER': sessionParameter.parameterName
                    }
                    , functionName: this.properties.getApplicationName() + 'DeallocateGamerFn'
                    , description: 'This function deallocates the gamer when a relevant event is identified (sign out, close window etc)'
                    , memorySize: 128
                    , timeout: 60
                    , role: new IAM.Role(this, this.properties.getApplicationName() + 'DeallocateGamerFn_Role', {
                        roleName: this.properties.getApplicationName() + 'DeallocateGamerFn_Role'
                        , assumedBy: new IAM.ServicePrincipal('lambda.amazonaws.com')
                        , managedPolicyArns: ['arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole']
                        , inlinePolicies: {
                            'DynamoDBPermissions':
                                new IAM.PolicyDocument().addStatement(
                                    new IAM.PolicyStatement()
                                        .allow()
                                        .addResource(sessionControlTable.tableArn)
                                        .addAction('dynamodb:GetItem')
                                        .addAction('dynamodb:UpdateItem')
                                        .addAction('dynamodb:Scan')
                                        .addAction('dynamodb:Query')
                                ),
                            'SystemsManagerPermissions':
                                new IAM.PolicyDocument().addStatement(
                                    new IAM.PolicyStatement()
                                        .allow()
                                        .addResource('arn:aws:ssm:'+this.properties.region+':'+this.properties.accountId+':parameter'+sessionParameter.parameterName)
                                        .addAction('ssm:GetParameter')
                                        .addAction('ssm:GetParameters')
                                ),
                        }
                    })
                });
            return createdFunction;
        }
        else return undefined;
    }

    private getScoreboardFunction() {

        let dlq = new SQS.Queue(this, this.properties.getApplicationName() + 'DLQ', {
            queueName: this.properties.getApplicationName() + 'DLQ'
        })

        /**
         * This function requires access to 
         * Queue
         *      process.env.DLQ_URL = "https://sqs.<region>.amazonaws.com/<account>/<envName>_DLQ"
         * SystemsManager
         *      process.env.SESSION_PARAMETER = /<getAppRefName>/session
         * DynamoDB Tables
         *      process.env.SESSION_TABLENAME = getAppRefName+'Session'
         *      process.env.SESSION_CONTROL_TABLENAME = getAppRefName+'SessionControl'
         *      process.env.SESSIONTOPX_TABLENAME = getAppRefName+'SessionTopX'
         */
        // MISSING PARAMETER - side effect - remove the next line, uncomment the next one.
        let sessionParameter = { parameterName : '/'+this.properties.getApplicationName().toLocaleLowerCase()+'/session'};
        //let sessionParameter: CfnParameter | undefined = <CfnParameter> this.properties.getParameter('parameter.session');
        let sessionControlTable: Table | undefined = <Table> this.properties.getParameter('table.sessionControl');
        let sessionTopX: Table | undefined = <Table> this.properties.getParameter('table.sessionTopX');
        let sessionTable: Table | undefined = <Table> this.properties.getParameter('table.session');
        if (sessionParameter && sessionControlTable && sessionTopX && sessionTable) {
            let createdFunction: Lambda.Function =
                new Lambda.Function(this, this.properties.getApplicationName() + 'ScoreboardFn', {
                    runtime: Lambda.Runtime.NodeJS610,
                    handler: 'index.handler',
                    code: Lambda.Code.asset(path.join(lambdasLocation,'scoreboard')),
                    environment: {
                        'DLQ_URL': dlq.queueUrl,
                        'SESSION_PARAMETER': sessionParameter.parameterName,
                        'SESSION_TABLENAME': sessionTable.tableName,
                        'SESSION_CONTROL_TABLENAME': sessionControlTable.tableName,
                        'SESSION_TOPX_TABLENAME': sessionTopX.tableName,
                        'TopXValue': '10'
                    }
                    , functionName: this.properties.getApplicationName() + 'ScoreboardFn'
                    , description: 'This function computes the scoreboard'
                    , memorySize: 128
                    , timeout: 60
                    , role: new IAM.Role(this, this.properties.getApplicationName() + 'ScoreboardFn_Role', {
                        roleName: this.properties.getApplicationName() + 'ScoreboardFn_Role'
                        , assumedBy: new IAM.ServicePrincipal('lambda.amazonaws.com')
                        , managedPolicyArns: ['arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole']
                        , inlinePolicies: {
                            'DynamoDBPermissions':
                                new IAM.PolicyDocument().addStatement(
                                    new IAM.PolicyStatement()
                                        .allow()
                                        .addResource('arn:aws:dynamodb:' + this.properties.region + ':' + this.properties.accountId + ':table/' + this.properties.getApplicationName() + '*')
                                        .addAction('dynamodb:GetItem')
                                        .addAction('dynamodb:UpdateItem')
                                        .addAction('dynamodb:Scan')
                                        .addAction('dynamodb:Query')
                                        .addAction('dynamodb:Batch*')
                                        .addAction('dynamodb:PutItem')
                                        .addAction('dynamodb:DeleteItem')
                                ),
                            'SystemsManagerPermissions':
                                new IAM.PolicyDocument().addStatement(
                                    new IAM.PolicyStatement()
                                        .allow()
                                        .addResource('arn:aws:ssm:' + this.properties.region + ':' + this.properties.accountId + ':parameter/' + this.properties.getApplicationName().toLowerCase() + '*')
                                        .addAction('ssm:Get*')
                                        .addAction('ssm:Get*')
                                        .addAction('ssm:List*')
                                ),
                            'SQSPermissions':
                                new IAM.PolicyDocument().addStatement(
                                    new IAM.PolicyStatement()
                                        .allow()
                                        .addResource(dlq.queueArn)
                                        .addAction('sqs:SendMessage')
                                ),
                            'KinesisPermissions':
                                new IAM.PolicyDocument().addStatement(
                                    new IAM.PolicyStatement()
                                        .allow()
                                        .addActions(
                                            "kinesis:SubscribeToShard",
                                            "kinesis:GetShardIterator",
                                            "kinesis:GetRecords",
                                            "kinesis:DescribeStream"
                                        )
                                        .addAllResources()
                                )
                        }
                    })
                });
            return createdFunction;
        }
        else return undefined;
    }

}

