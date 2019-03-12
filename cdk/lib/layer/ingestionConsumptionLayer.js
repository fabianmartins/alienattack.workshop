"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const resourceawarestack_1 = require("./../resourceawarestack");
const KDS = require("@aws-cdk/aws-kinesis");
const KDF = require("@aws-cdk/aws-kinesisfirehose");
const IAM = require("@aws-cdk/aws-iam");
const APIGTW = require("@aws-cdk/aws-apigateway");
const aws_iam_1 = require("@aws-cdk/aws-iam");
const Lambda = require("@aws-cdk/aws-lambda");
const aws_lambda_event_sources_1 = require("@aws-cdk/aws-lambda-event-sources");
class IngestionConsumptionLayer extends resourceawarestack_1.ResourceAwareConstruct {
    constructor(parent, name, props) {
        super(parent, name, props);
        this.rawbucketarn = props.getParameter('rawbucketarn');
        this.userpool = props.getParameter('userpool');
        this.createKinesis(props);
        this.createAPIGateway(props);
        this.updateUsersRoles(props);
    }
    createKinesis(props) {
        this.kinesisStreams = new KDS.Stream(this, props.getAppRefName() + 'InputStream', {
            streamName: props.getAppRefName() + '_InputStream',
            shardCount: 1
        });
        props.getParameter('lambda.scoreboard').addEventSource(new aws_lambda_event_sources_1.KinesisEventSource(this.kinesisStreams, {
            batchSize: 700,
            startingPosition: Lambda.StartingPosition.Latest
        }));
        let firehoseLogGroup = '/aws/kinesisfirehose/' + ((props.getAppRefName() + 'firehose').toLowerCase());
        let self = this;
        let firehoseRole = new IAM.Role(this, props.getAppRefName() + 'FirehoseToStreamsRole', {
            roleName: props.getAppRefName() + 'FirehoseToStreamsRole',
            assumedBy: new IAM.ServicePrincipal('firehose.amazonaws.com'),
            inlinePolicies: {
                'S3RawDataPermission': new aws_iam_1.PolicyDocument()
                    .addStatement(new IAM.PolicyStatement()
                    .allow()
                    .addAction('s3:AbortMultipartUpload')
                    .addAction('s3:GetBucketLocation')
                    .addAction('s3:GetObject')
                    .addAction('s3:ListBucket')
                    .addAction('s3:ListBucketMultipartUploads')
                    .addAction('s3:PutObject')
                    .addResource(self.rawbucketarn)
                    .addResource(self.rawbucketarn + '/*')),
                'InputStreamReadPermissions': new aws_iam_1.PolicyDocument()
                    .addStatement(new IAM.PolicyStatement()
                    .allow()
                    .addAction('kinesis:DescribeStream')
                    .addAction('kinesis:GetShardIterator')
                    .addAction('kinesis:GetRecords')
                    .addResource(this.kinesisStreams.streamArn))
                /*,
                // if s3 encryption is configured
                'DecryptionPermissions': new PolicyDocument()
                    .addStatement(new IAM.PolicyStatement()
                        .allow()
                        .addAction('kms:Decrypt')
                        .addAction('kms:GenerateDataKey')
                        .addResource('arn:aws:kms:'+props.region+':'+props.accountId+':key/aws/s3')
                        .addCondition('StringEquals', {
                            'kms:ViaService': 'kinesis.' + props.region + '.amazonaws.com'
                        })
                        .addCondition('StringLike',{
                            'kms:EncryptionContext:aws:s3:arn' : 'arn:aws:s3:::'+props.s3BucketRawDataArn+'/*'
                        })
                    )
                    */
                ,
                'GluePermissions': new aws_iam_1.PolicyDocument()
                    .addStatement(new IAM.PolicyStatement()
                    .allow()
                    .addAllResources()
                    .addAction('glue:GetTableVersions')),
                'CloudWatchLogsPermissions': new aws_iam_1.PolicyDocument()
                    .addStatement(new IAM.PolicyStatement()
                    .allow()
                    .addAction('logs:PutLogEvents')
                    .addResource('arn:aws:logs:' + props.region + ':' + props.accountId + ':log-group:' + firehoseLogGroup + ':*:*')
                    .addResource('arn:aws:logs:' + props.region + ':' + props.accountId + ':log-group:' + firehoseLogGroup))
                /* ,
                  // if record transformation is selected
                 'InternalLambdaInvocationPermissions' : new PolicyDocument()
                     .addStatement( new IAM.PolicyStatement()
                         .allow()
                         .addAction('lambda:InvokeFunction')
                         .addAction('lambda:GetFunctionConfiguration')
                         .addResource('arn:aws:lambda:'+props.region+':'+props.accountId+':function:%FIREHOSE_DEFAULT_FUNCTION%:%FIREHOSE_DEFAULT_VERSION%')
                 )
                         */
            }
        });
        this.kinesisFirehose = new KDF.CfnDeliveryStream(this, props.getAppRefName() + 'RawData', {
            deliveryStreamType: 'KinesisStreamAsSource',
            deliveryStreamName: props.getAppRefName() + 'Firehose',
            kinesisStreamSourceConfiguration: {
                kinesisStreamArn: this.kinesisStreams.streamArn,
                roleArn: firehoseRole.roleArn
            },
            s3DestinationConfiguration: {
                bucketArn: this.rawbucketarn,
                bufferingHints: {
                    intervalInSeconds: 900,
                    sizeInMBs: 10
                },
                compressionFormat: 'GZIP',
                roleArn: firehoseRole.roleArn,
                cloudWatchLoggingOptions: {
                    enabled: true,
                    logGroupName: firehoseLogGroup,
                    logStreamName: firehoseLogGroup
                }
            }
        });
    }
    createAPIGateway(props) {
        let apirole = new IAM.Role(this, props.getAppRefName() + 'APIRole', {
            roleName: props.getAppRefName() + 'API',
            assumedBy: new IAM.ServicePrincipal('apigateway.amazonaws.com'),
            inlinePolicies: {
                'LambdaPermissions': new aws_iam_1.PolicyDocument()
                    .addStatement(new IAM.PolicyStatement()
                    .allow()
                    .addAction('lambda:InvokeFunction')
                    .addAction('lambda:InvokeAsync')
                    .addResource('arn:aws:lambda:' + props.region + ':' + props.accountId + ':function:' + props.getAppRefName() + '*')),
                'SSMPermissions': new aws_iam_1.PolicyDocument()
                    .addStatement(new IAM.PolicyStatement()
                    .allow()
                    .addActions("ssm:GetParameterHistory")
                    .addAction("ssm:GetParametersByPath")
                    .addAction("ssm:GetParameters")
                    .addAction("ssm:GetParameter")
                    .addResource('arn:aws:ssm:'.concat(props.region, ':', props.accountId, ':parameter/', props.getAppRefName().toLowerCase(), '/*'))),
                'DynamoDBPermissions': new aws_iam_1.PolicyDocument()
                    .addStatement(new IAM.PolicyStatement()
                    .allow()
                    .addAction('dynamodb:GetItem')
                    .addResources(props.getParameter('table.session').tableArn, props.getParameter('table.sessiontopx').tableArn)),
                'KinesisPermissions': new aws_iam_1.PolicyDocument()
                    .addStatement(new IAM.PolicyStatement()
                    .addAction('kinesis:PutRecord')
                    .addAction('kinesis:PutRecords')
                    .addResource(this.kinesisStreams.streamArn))
            }
        });
        apirole.attachManagedPolicy('arn:aws:iam::aws:policy/service-role/AmazonAPIGatewayPushToCloudWatchLogs');
        this.api = new APIGTW.CfnRestApi(this, props.getAppRefName() + "API", {
            name: props.getAppRefName().toLowerCase(),
            description: 'API supporting the application ' + props.getAppRefName()
        });
        new APIGTW.CfnGatewayResponse(this, props.getAppRefName() + 'GTWResponse', {
            restApiId: this.api.restApiId,
            responseType: 'DEFAULT_4XX',
            responseParameters: {
                "gatewayresponse.header.Access-Control-Allow-Headers": "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
                "gatewayresponse.header.Access-Control-Allow-Methods": "'*'",
                "gatewayresponse.header.Access-Control-Allow-Origin": "'*'"
            },
            responseTemplates: {
                "application/json": "{\"message\":$context.error.messageString}"
            }
        }).addDependsOn(this.api);
        let authorizer = new APIGTW.CfnAuthorizer(this, props.getAppRefName() + "Authorizer", {
            name: props.getAppRefName().toLowerCase() + 'Authorizer',
            restApiId: this.api.restApiId,
            type: 'COGNITO_USER_POOLS',
            identitySource: 'method.request.header.Authorization',
            providerArns: [
                this.userpool
            ]
        });
        let apiModelScoreboardResponse = new APIGTW.CfnModel(this, props.getAppRefName() + 'APIModelScoreboardResponseModel', {
            contentType: 'application/json',
            description: 'Scoreboard response model (for /scoreboard/GET)',
            name: 'ScoreboardResponseModel',
            restApiId: this.api.restApiId,
            schema: {
                "$schema": "http://json-schema.org/draft-04/schema#",
                "title": "ScoreboardResponseModel",
                "type": "object",
                "properties": {
                    "Scoreboard": {
                        "type": "array",
                        "items": {
                            "$ref": "#/definitions/GamerScore"
                        }
                    }
                },
                "definitions": {
                    "GamerScore": {
                        "type": "object",
                        "properties": {
                            "Name": { "type": "integer" },
                            "Score": { "type": "integer" },
                            "Level": { "type": "integer" },
                            "Shots": { "type": "integer" },
                            "Nickname": { "type": "string" },
                            "Lives": { "type": "integer" }
                        }
                    }
                }
            }
        });
        let apiModelGetParametersRequest = new APIGTW.CfnModel(this, props.getAppRefName() + 'APIModelGetParametersRequest', {
            contentType: 'application/json',
            description: 'Model to request SSM:GetParameters',
            name: 'GetParametersRequest',
            restApiId: this.api.restApiId,
            schema: {
                "$schema": "http://json-schema.org/draft-04/schema#",
                "title": "GetParametersRequest",
                "type": "object",
                "properties": {
                    "names": { "type": "array" }
                }
            }
        });
        //Version 1 of the API
        let v1 = new APIGTW.CfnResource(this, props.getAppRefName() + "APIv1", {
            parentId: this.api.restApiRootResourceId,
            pathPart: 'v1',
            restApiId: this.api.restApiId
        });
        /**
         * SESSION resource /session
         * GET {no parameter} - returns session data from ssm.parameter /ssm/session
         *
         */
        let session = new APIGTW.CfnResource(this, props.getAppRefName() + "APIv1session", {
            parentId: v1.resourceId,
            pathPart: 'session',
            restApiId: this.api.restApiId
        });
        let sessionGetMethod = new APIGTW.CfnMethod(this, props.getAppRefName() + "APIv1sessionGET", {
            restApiId: this.api.restApiId,
            resourceId: session.resourceId,
            authorizationType: APIGTW.AuthorizationType.Cognito,
            authorizerId: authorizer.authorizerId,
            httpMethod: 'GET',
            requestParameters: {
                'method.request.querystring.Name': true,
                'method.request.header.Authentication': true
            },
            requestModels: undefined,
            integration: {
                passthroughBehavior: 'WHEN_NO_MATCH',
                integrationHttpMethod: 'POST',
                type: 'AWS',
                uri: 'arn:aws:apigateway:' + props.region + ':ssm:action/GetParameter',
                credentials: apirole.roleArn,
                requestParameters: {
                    'integration.request.querystring.Name': "'/" + props.getAppRefName().toLowerCase() + "/session'",
                    'integration.request.header.Authentication': 'method.request.header.Authentication'
                },
                requestTemplates: undefined,
                integrationResponses: [
                    {
                        statusCode: '200',
                        responseParameters: {
                            'method.response.header.Access-Control-Allow-Origin': "'*'"
                        },
                        responseTemplates: {
                            'application/json': `"$util.escapeJavaScript("$input.path('$').GetParameterResponse.GetParameterResult.Parameter.Value").replaceAll("\'",'"')"`
                        }
                    }
                ]
            },
            methodResponses: [
                {
                    statusCode: '200',
                    responseParameters: {
                        'method.response.header.Access-Control-Allow-Origin': false
                    },
                    responseModels: {
                        'application/json': 'Empty'
                    }
                }
            ]
        });
        // OPTIONS
        let sessionOptionsMethod = new APIGTW.CfnMethod(this, props.getAppRefName() + "APIv1sessionOPTIONS", {
            restApiId: this.api.restApiId,
            resourceId: session.resourceId,
            authorizationType: APIGTW.AuthorizationType.None,
            httpMethod: 'OPTIONS',
            integration: {
                passthroughBehavior: 'WHEN_NO_MATCH',
                type: 'MOCK',
                requestTemplates: {
                    'application/json': '{\"statusCode\": 200}'
                },
                integrationResponses: [
                    {
                        statusCode: '200',
                        responseParameters: {
                            'method.response.header.Access-Control-Allow-Headers': "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
                            'method.response.header.Access-Control-Allow-Methods': "'*'",
                            'method.response.header.Access-Control-Allow-Origin': "'*'"
                            /*
                              'method.response.header.Access-Control-Allow-Origin': "'*'"
                            , 'method.response.header.Access-Control-Allow-Methods': "'GET,OPTIONS'"
                            , 'method.response.header.Access-Control-Allow-Headers': "'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token'"
                            */
                        }
                    }
                ]
            },
            methodResponses: [
                {
                    statusCode: '200',
                    responseParameters: {
                        'method.response.header.Access-Control-Allow-Origin': false,
                        'method.response.header.Access-Control-Allow-Methods': false,
                        'method.response.header.Access-Control-Allow-Headers': false
                    },
                    responseModels: {
                        "application/json": 'Empty'
                    }
                }
            ]
        });
        /**
         * CONFIG
         * Resource: /config
         * Method: GET
         * Request Parameters : none
         * Response format:
            {
            "Parameters": [
                {
                "Name": "/<app>/clientid",
                "Value": "4tfe5l26kdp59tc4k4v0b688nm"
                },
                {
                "Name": "/<app>/identitypoolid",
                "Value": "<region>:17092df6-7e3a-4893-4d85-c6de33cdfabc"
                },
                {
                "Name": "/<app>>/userpoolid",
                "Value": "<region>_ueLfdaSXi"
                },
                {
                "Name": "/<app>>/userpoolurl",
                "Value": "cognito-idp.<region>>.amazonaws.com/<region>_ueLfdaSXi"
                }
            ]
            }
         */
        let config = new APIGTW.CfnResource(this, props.getAppRefName() + "APIv1config", {
            parentId: v1.resourceId,
            pathPart: 'config',
            restApiId: this.api.restApiId
        });
        // GET
        let configGetMethod = new APIGTW.CfnMethod(this, props.getAppRefName() + "APIv1configGET", {
            restApiId: this.api.restApiId,
            resourceId: config.resourceId,
            authorizationType: APIGTW.AuthorizationType.None,
            httpMethod: 'GET',
            requestParameters: {
                'method.request.header.Content-Type': true,
                'method.request.header.X-Amz-Target': true
            },
            requestModels: {
                'application/json': apiModelGetParametersRequest.ref
            },
            integration: {
                integrationHttpMethod: 'POST',
                type: 'AWS',
                uri: 'arn:aws:apigateway:' + props.region + ':ssm:path//',
                credentials: apirole.roleArn,
                requestParameters: {
                    'integration.request.header.Content-Type': "'application/x-amz-json-1.1'",
                    'integration.request.header.X-Amz-Target': "'AmazonSSM.GetParameters'"
                },
                requestTemplates: {
                    'application/json': '{"Names" : [' +
                        '"/' + props.getAppRefName().toLowerCase() + '/userpoolid",' +
                        '"/' + props.getAppRefName().toLowerCase() + '/userpoolurl",' +
                        '"/' + props.getAppRefName().toLowerCase() + '/clientid",' +
                        '"/' + props.getAppRefName().toLowerCase() + '/identitypoolid"' +
                        ']}'
                },
                passthroughBehavior: 'WHEN_NO_TEMPLATES',
                integrationResponses: [
                    {
                        statusCode: '200',
                        responseParameters: {
                            'method.response.header.Access-Control-Allow-Origin': "'*'"
                        },
                        responseTemplates: {
                            'application/json': `
                                #set($inputRoot = $input.path('$'))
                                {
                                    "Parameters" : [
                                        #foreach($elem in $inputRoot.Parameters)
                                        {
                                            "Name" : "$elem.Name",
                                            "Value" :  "$util.escapeJavaScript("$elem.Value").replaceAll("'",'"')"
                                        } 
                                        #if($foreach.hasNext),#end
                                    #end
                                ]
                                }`
                        }
                    }
                ]
            },
            methodResponses: [
                {
                    statusCode: '200',
                    responseParameters: {
                        'method.response.header.Access-Control-Allow-Origin': true
                    },
                    responseModels: {
                        'application/json': 'Empty'
                    }
                }
            ]
        });
        // OPTIONS
        let configOptionsMethod = new APIGTW.CfnMethod(this, props.getAppRefName() + "APIv1configOPTIONS", {
            restApiId: this.api.restApiId,
            resourceId: config.resourceId,
            authorizationType: APIGTW.AuthorizationType.None,
            httpMethod: 'OPTIONS',
            integration: {
                passthroughBehavior: 'when_no_match',
                type: 'MOCK',
                requestTemplates: {
                    'application/json': `{\"statusCode\": 200}`
                },
                integrationResponses: [
                    {
                        statusCode: '200',
                        responseParameters: {
                            'method.response.header.Access-Control-Allow-Origin': "'*'",
                            'method.response.header.Access-Control-Allow-Methods': "'*'",
                            'method.response.header.Access-Control-Allow-Headers': "'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token'"
                        }
                    }
                ]
            },
            methodResponses: [
                {
                    statusCode: '200',
                    responseParameters: {
                        'method.response.header.Access-Control-Allow-Origin': true,
                        'method.response.header.Access-Control-Allow-Methods': true,
                        'method.response.header.Access-Control-Allow-Headers': true
                    },
                    responseModels: {
                        'application/json': 'Empty'
                    }
                }
            ]
        });
        /**
         * ALLOCATE
         * Resource: /allocate
         * Method: POST
         * Request format: { 'Username' : '<the user name>'}
         */
        let allocate = new APIGTW.CfnResource(this, props.getAppRefName() + "APIv1allocate", {
            parentId: v1.resourceId,
            pathPart: 'allocate',
            restApiId: this.api.restApiId
        });
        let lambdaAllocate = props.getParameter('lambda.allocate');
        // POST
        let allocatePostMethod = new APIGTW.CfnMethod(this, props.getAppRefName() + "APIv1allocatePOST", {
            restApiId: this.api.restApiId,
            resourceId: allocate.resourceId,
            authorizationType: APIGTW.AuthorizationType.Cognito,
            authorizerId: authorizer.authorizerId,
            httpMethod: 'POST',
            integration: {
                passthroughBehavior: 'WHEN_NO_MATCH',
                integrationHttpMethod: 'POST',
                type: 'AWS_PROXY',
                uri: 'arn:aws:apigateway:' + props.region + ':lambda:path/2015-03-31/functions/' + lambdaAllocate.functionArn + '/invocations',
                credentials: apirole.roleArn
                //  , uri: 'arn:aws:apigateway:' + props.region + ':lambda:path/2015-03-31/functions/' + props.getParameter('lambda.allocate') + '/invocations'
            },
            methodResponses: [
                {
                    statusCode: '200'
                }
            ]
        });
        /* TO BE IMPLEMENTED ON CDK
                lambdaAllocate.addEventSource(
                    new ApiEventSource( 'POST','/v1/allocate',{
                           authorizationType : APIGTW.AuthorizationType.Cognito
                         , authorizerId : authorizer.authorizerId
                    })
                );
        */
        // OPTIONS
        let allocateOptionsMethod = new APIGTW.CfnMethod(this, props.getAppRefName() + "APIv1allocateOPTIONS", {
            restApiId: this.api.restApiId,
            resourceId: allocate.resourceId,
            authorizationType: APIGTW.AuthorizationType.None,
            httpMethod: 'OPTIONS',
            integration: {
                passthroughBehavior: 'WHEN_NO_MATCH',
                type: 'MOCK',
                requestTemplates: {
                    'application/json': `{\"statusCode\": 200}`
                },
                integrationResponses: [
                    {
                        statusCode: '200',
                        responseParameters: {
                            'method.response.header.Access-Control-Allow-Origin': "'*'",
                            'method.response.header.Access-Control-Allow-Methods': "'*'",
                            'method.response.header.Access-Control-Allow-Headers': "'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token'"
                        }
                    }
                ]
            },
            methodResponses: [
                {
                    statusCode: '200',
                    responseParameters: {
                        'method.response.header.Access-Control-Allow-Origin': true,
                        'method.response.header.Access-Control-Allow-Methods': true,
                        'method.response.header.Access-Control-Allow-Headers': true
                    },
                    responseModels: {
                        'application/json': 'Empty'
                    }
                }
            ]
        });
        /**
         * DEALLOCATE
         * Resource: /deallocate
         * Method: POST
         * Request format: { 'Username' : '<the user name>'}
         */
        let deallocate = new APIGTW.CfnResource(this, props.getAppRefName() + "APIv1deallocate", {
            parentId: v1.resourceId,
            pathPart: 'deallocate',
            restApiId: this.api.restApiId
        });
        // POST
        let deallocatePostMethod = new APIGTW.CfnMethod(this, props.getAppRefName() + "APIv1deallocatePOST", {
            restApiId: this.api.restApiId,
            resourceId: deallocate.resourceId,
            authorizationType: APIGTW.AuthorizationType.Cognito,
            authorizerId: authorizer.authorizerId,
            httpMethod: 'POST',
            integration: {
                integrationHttpMethod: 'POST',
                type: 'AWS_PROXY',
                contentHandling: "CONVERT_TO_TEXT",
                uri: 'arn:aws:apigateway:' + props.region + ':lambda:path/2015-03-31/functions/' + props.getParameter('lambda.deallocate') + '/invocations',
                credentials: apirole.roleArn
            },
            methodResponses: [
                {
                    statusCode: '200'
                }
            ]
        });
        // OPTIONS
        let deallocateOptionsMethod = new APIGTW.CfnMethod(this, props.getAppRefName() + "APIv1deallocateOPTIONS", {
            restApiId: this.api.restApiId,
            resourceId: deallocate.resourceId,
            authorizationType: APIGTW.AuthorizationType.None,
            httpMethod: 'OPTIONS',
            integration: {
                passthroughBehavior: 'when_no_match',
                type: 'MOCK',
                requestTemplates: {
                    'application/json': `{\"statusCode\": 200}`
                },
                integrationResponses: [
                    {
                        statusCode: '200',
                        responseParameters: {
                            'method.response.header.Access-Control-Allow-Origin': "'*'",
                            'method.response.header.Access-Control-Allow-Methods': "'*'",
                            'method.response.header.Access-Control-Allow-Headers': "'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token'"
                        }
                    }
                ]
            },
            methodResponses: [
                {
                    statusCode: '200',
                    responseParameters: {
                        'method.response.header.Access-Control-Allow-Origin': true,
                        'method.response.header.Access-Control-Allow-Methods': true,
                        'method.response.header.Access-Control-Allow-Headers': true
                    },
                    responseModels: {
                        'application/json': 'Empty'
                    }
                }
            ]
        });
        /**
         * SCOREBOARD
         * Resource: /deallocate
         * Method: GET
         * Request format:
         *      querystring: sessionId=<<Session Id>>
         * Response format:
         * {
                "Scoreboard": [
                    {
                    "Score": 7055,
                    "Level": 13,
                    "Shots": 942,
                    "Nickname": "PSC",
                    "Lives": 3
                    }..,
                ]
            }
         */
        let scoreboard = new APIGTW.CfnResource(this, props.getAppRefName() + "APIv1scoreboard", {
            parentId: v1.resourceId,
            pathPart: 'scoreboard',
            restApiId: this.api.restApiId
        });
        // POST
        let scoreboardPostMethod = new APIGTW.CfnMethod(this, props.getAppRefName() + "APIv1scoreboardPOST", {
            restApiId: this.api.restApiId,
            resourceId: scoreboard.resourceId,
            authorizationType: APIGTW.AuthorizationType.Cognito,
            authorizerId: authorizer.authorizerId,
            httpMethod: 'GET',
            requestParameters: {
                'method.request.querystring.sessionId': true
            },
            integration: {
                integrationHttpMethod: 'POST',
                type: 'AWS',
                uri: 'arn:aws:apigateway:' + props.region + ':dynamodb:action/GetItem',
                credentials: apirole.roleArn,
                requestParameters: {
                    'integration.request.querystring.sessionId': 'method.request.querystring.sessionId'
                },
                passthroughBehavior: 'WHEN_NO_TEMPLATES',
                requestTemplates: {
                    'application/json': `{
                        "TableName" : "` + props.getParameter('table.sessiontopx').tableName + `",
                        "Key" : {
                            "SessionId" : {
                                "S" : "$input.params('sessionId')"
                            }
                        }
                    }`
                },
                integrationResponses: [
                    {
                        statusCode: '200',
                        responseParameters: {
                            'method.response.header.Access-Control-Allow-Origin': "'*'"
                        },
                        responseTemplates: {
                            // This is going to be tricky to be generalized
                            'application/json': `#set($scoreboard = $input.path('$.Item.TopX.L'))
                                        { 
                                        "Scoreboard" : [
                                                #foreach($gamerScore in $scoreboard)
                                                        {
                                                            "Score" : $gamerScore.M.Score.N ,
                                                            "Level" : $gamerScore.M.Level.N ,
                                                            "Shots" : $gamerScore.M.Shots.N ,
                                                            "Nickname" : "$gamerScore.M.Nickname.S" ,
                                                            "Lives" : $gamerScore.M.Lives.N
                                                        }#if($foreach.hasNext),#end
                                                
                                                #end
                                            ]
                                        }`
                        }
                    }
                ]
            },
            methodResponses: [
                {
                    statusCode: '200',
                    responseParameters: {
                        'method.response.header.Access-Control-Allow-Origin': true
                    },
                    responseModels: {
                        'application/json': apiModelScoreboardResponse.ref
                    }
                }
            ]
        });
        // OPTIONS
        let scoreboardOptionsMethod = new APIGTW.CfnMethod(this, props.getAppRefName() + "APIv1scoreboardOPTIONS", {
            restApiId: this.api.restApiId,
            resourceId: scoreboard.resourceId,
            authorizationType: APIGTW.AuthorizationType.None,
            httpMethod: 'OPTIONS',
            integration: {
                passthroughBehavior: 'when_no_match',
                type: 'MOCK',
                requestTemplates: {
                    'application/json': `{\"statusCode\": 200}`
                },
                integrationResponses: [
                    {
                        statusCode: '200',
                        responseParameters: {
                            'method.response.header.Access-Control-Allow-Origin': "'*'",
                            'method.response.header.Access-Control-Allow-Methods': "'*'",
                            'method.response.header.Access-Control-Allow-Headers': "'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token'"
                        }
                    }
                ]
            },
            methodResponses: [
                {
                    statusCode: '200',
                    responseParameters: {
                        'method.response.header.Access-Control-Allow-Origin': true,
                        'method.response.header.Access-Control-Allow-Methods': true,
                        'method.response.header.Access-Control-Allow-Headers': true
                    },
                    responseModels: {
                        'application/json': 'Empty'
                    }
                }
            ]
        });
        /**
         * UPDATESTATUS
         * Resource: /updatestatus
         * Method: POST
         * Request format:
         *  body : {
         *       "Level": 1,
         *       "Lives": 3,
         *       "Nickname": "chicobento",
         *       "Score": 251,
         *       "SessionId": "X181001T215808",
         *       "Shots": 4,
         *       "Timestamp": "2018-10-10T23:57:26.137Z"
         *       }
         */
        let updateStatus = new APIGTW.CfnResource(this, props.getAppRefName() + "APIv1updatestatus", {
            parentId: v1.resourceId,
            pathPart: 'updatestatus',
            restApiId: this.api.restApiId
        });
        // POST
        let updatestatusPostMethod = new APIGTW.CfnMethod(this, props.getAppRefName() + "APIv1updatestatusPOST", {
            restApiId: this.api.restApiId,
            resourceId: updateStatus.resourceId,
            authorizationType: APIGTW.AuthorizationType.Cognito,
            authorizerId: authorizer.authorizerId,
            httpMethod: 'POST',
            requestParameters: {
                'method.request.header.Authentication': true
            },
            integration: {
                integrationHttpMethod: 'POST',
                type: 'AWS',
                uri: 'arn:aws:apigateway:' + props.region + ':kinesis:action/PutRecord',
                credentials: apirole.roleArn,
                passthroughBehavior: 'WHEN_NO_TEMPLATES',
                requestTemplates: {
                    'application/json': `#set($inputRoot = $input.path('$'))
                        {
                            "Data" : "$util.base64Encode("$input.json('$')")",
                            "PartitionKey" : $input.json('$.SessionId'),
                            "StreamName" : "` + this.kinesisStreams.streamName + `"
                        }`
                },
                integrationResponses: [
                    {
                        statusCode: '200',
                        responseParameters: {
                            'method.response.header.Access-Control-Allow-Origin': "'*'"
                        }
                    }
                ]
            },
            methodResponses: [
                {
                    statusCode: '200',
                    responseParameters: {
                        'method.response.header.Access-Control-Allow-Origin': true
                    },
                    responseModels: {
                        'application/json': 'Empty'
                    }
                }
            ]
        });
        // OPTIONS
        let updatestatusOptionsMethod = new APIGTW.CfnMethod(this, props.getAppRefName() + "APIv1updateStatusOPTIONS", {
            restApiId: this.api.restApiId,
            resourceId: updateStatus.resourceId,
            authorizationType: APIGTW.AuthorizationType.None,
            httpMethod: 'OPTIONS',
            integration: {
                passthroughBehavior: 'when_no_match',
                type: 'MOCK',
                requestTemplates: {
                    'application/json': `{\"statusCode\": 200}`
                },
                integrationResponses: [
                    {
                        statusCode: '200',
                        responseParameters: {
                            'method.response.header.Access-Control-Allow-Origin': "'*'",
                            'method.response.header.Access-Control-Allow-Methods': "'*'",
                            'method.response.header.Access-Control-Allow-Headers': "'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token'"
                        }
                    }
                ]
            },
            methodResponses: [
                {
                    statusCode: '200',
                    responseParameters: {
                        'method.response.header.Access-Control-Allow-Origin': true,
                        'method.response.header.Access-Control-Allow-Methods': true,
                        'method.response.header.Access-Control-Allow-Headers': true
                    },
                    responseModels: {
                        'application/json': 'Empty'
                    }
                }
            ]
        });
        let deployment = new APIGTW.CfnDeployment(this, props.getAppRefName() + "APIDeployment", {
            restApiId: this.api.restApiId,
            stageName: 'prod',
            description: 'Production deployment'
        });
        deployment.addDependsOn(sessionGetMethod);
        deployment.addDependsOn(sessionOptionsMethod);
        deployment.addDependsOn(configGetMethod);
        deployment.addDependsOn(configOptionsMethod);
        deployment.addDependsOn(allocatePostMethod);
        deployment.addDependsOn(allocateOptionsMethod);
        deployment.addDependsOn(deallocatePostMethod);
        deployment.addDependsOn(deallocateOptionsMethod);
        deployment.addDependsOn(scoreboardPostMethod);
        deployment.addDependsOn(scoreboardOptionsMethod);
        deployment.addDependsOn(updatestatusPostMethod);
        deployment.addDependsOn(updatestatusOptionsMethod);
    }
    updateUsersRoles(props) {
        let baseArn = 'arn:aws:apigateway:' + props.region + ':' + props.accountId + ':' + this.api.restApiId + '/prod/*/';
        let baseExecArn = 'arn:aws:execute-api:' + props.region + ':' + props.accountId + ':' + this.api.restApiId + '/prod/';
        let playerRole = props.getParameter('security.playersrole');
        /*
        playerRole.addToPolicy(
            new IAM.PolicyStatement()
                .describe('APIGatewayPermissions')
                .allow()
                .addAction('execute-api:Invoke')
                .addResources(
                    baseArn
                )
        );
        */
        playerRole.addToPolicy(new IAM.PolicyStatement()
            .describe('APIGatewayGETPermissions')
            .allow()
            .addAction('apigateway:GET')
            .addResources(baseArn + 'config', baseArn + 'session', baseArn + 'scoreboard'));
        playerRole.addToPolicy(new IAM.PolicyStatement()
            .describe('APIGatewayEXECGETPermissions')
            .allow()
            .addAction('execute-api:Invoke')
            .addResources(baseExecArn + 'GET/config', baseExecArn + 'GET/session', baseExecArn + 'GET/scoreboard'));
        playerRole.addToPolicy(new IAM.PolicyStatement()
            .describe('APIGatewayPOSTPermissions')
            .allow()
            .addAction('apigateway:POST')
            .addResources(baseArn + 'updatestatus', baseArn + 'allocate', baseArn + 'deallocate'));
        playerRole.addToPolicy(new IAM.PolicyStatement()
            .describe('APIGatewayEXECPOSTPermissions')
            .allow()
            .addAction('execute-api:Invoke')
            .addResources(baseExecArn + 'POST/updatestatus', baseExecArn + 'POST/allocate', baseExecArn + 'POST/deallocate'));
        let managerRole = props.getParameter('security.managersrole');
        managerRole.addToPolicy(new IAM.PolicyStatement()
            .describe('DynamoDBPermissions')
            .allow()
            .addActions("dynamodb:BatchGetItem", "dynamodb:BatchWriteItem", "dynamodb:PutItem", "dynamodb:Scan", "dynamodb:Query", "dynamodb:GetItem")
            .addResource("arn:aws:dynamodb:" + props.region + ":" + props.accountId + ":table/" + props.getAppRefName() + "*"));
        managerRole.addToPolicy(new IAM.PolicyStatement()
            .describe('SystemsManagerPermissions')
            .addActions("ssm:GetParameters", "ssm:GetParameter", "ssm:DeleteParameters", "ssm:PutParameter", "ssm:DeleteParameter")
            .addResource("arn:aws:ssm:" + props.region + ":" + props.accountId + ":parameter/" + props.getAppRefName().toLowerCase() + "/*"));
        managerRole.addToPolicy(new IAM.PolicyStatement()
            .describe('KinesisPermissions')
            .addActions("kinesis:GetShardIterator", "kinesis:DescribeStream", "kinesis:GetRecords")
            .addResource(this.kinesisStreams.streamArn));
        /*
        managerRole.addToPolicy(
            new IAM.PolicyStatement()
                .describe('APIGatewayPermissions')
                .allow()
                .addAction('execute-api:Invoke')
                .addResources(
                    baseArn
                )
        );
                */
        managerRole.addToPolicy(new IAM.PolicyStatement()
            .describe('APIGatewayPermissions')
            .allow()
            .addAction('apigateway:*')
            .addResources(baseArn + '*'));
    }
}
exports.IngestionConsumptionLayer = IngestionConsumptionLayer;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5nZXN0aW9uQ29uc3VtcHRpb25MYXllci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImluZ2VzdGlvbkNvbnN1bXB0aW9uTGF5ZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFDQSxnRUFBc0Y7QUFHdEYsNENBQTZDO0FBQzdDLG9EQUFxRDtBQUNyRCx3Q0FBeUM7QUFDekMsa0RBQW1EO0FBQ25ELDhDQUFrRDtBQUVsRCw4Q0FBK0M7QUFDL0MsZ0ZBQXVGO0FBRXZGLE1BQWEseUJBQTBCLFNBQVEsMkNBQXNCO0lBUWpFLFlBQVksTUFBaUIsRUFBRSxJQUFZLEVBQUUsS0FBMkI7UUFDcEUsS0FBSyxDQUFDLE1BQU0sRUFBRSxJQUFJLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDM0IsSUFBSSxDQUFDLFlBQVksR0FBRyxLQUFLLENBQUMsWUFBWSxDQUFDLGNBQWMsQ0FBQyxDQUFDO1FBQ3ZELElBQUksQ0FBQyxRQUFRLEdBQUcsS0FBSyxDQUFDLFlBQVksQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUMvQyxJQUFJLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQzFCLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUM3QixJQUFJLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDakMsQ0FBQztJQUVELGFBQWEsQ0FBQyxLQUEyQjtRQUVyQyxJQUFJLENBQUMsY0FBYyxHQUFHLElBQUksR0FBRyxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLGFBQWEsRUFBRSxHQUFHLGFBQWEsRUFBRTtZQUM5RSxVQUFVLEVBQUUsS0FBSyxDQUFDLGFBQWEsRUFBRSxHQUFHLGNBQWM7WUFDbEQsVUFBVSxFQUFFLENBQUM7U0FDaEIsQ0FBQyxDQUFDO1FBRWdCLEtBQUssQ0FBQyxZQUFZLENBQUMsbUJBQW1CLENBQUUsQ0FBQyxjQUFjLENBRW5FLElBQUksNkNBQWtCLENBQUMsSUFBSSxDQUFDLGNB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ZXNDb250ZW50IjpbImltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ0Bhd3MtY2RrL2Nkayc7XG5pbXBvcnQgeyBSZXNvdXJjZUF3YXJlQ29uc3RydWN0LCBJUGFyYW1ldGVyQXdhcmVQcm9wcyB9IGZyb20gJy4vLi4vcmVzb3VyY2Vhd2FyZXN0YWNrJ1xuXG5cbmltcG9ydCBLRFMgPSByZXF1aXJlKCdAYXdzLWNkay9hd3Mta2luZXNpcycpO1xuaW1wb3J0IEtERiA9IHJlcXVpcmUoJ0Bhd3MtY2RrL2F3cy1raW5lc2lzZmlyZWhvc2UnKTtcbmltcG9ydCBJQU0gPSByZXF1aXJlKCdAYXdzLWNkay9hd3MtaWFtJyk7XG5pbXBvcnQgQVBJR1RXID0gcmVxdWlyZSgnQGF3cy1jZGsvYXdzLWFwaWdhdGV3YXknKTtcbmltcG9ydCB7IFBvbGljeURvY3VtZW50IH0gZnJvbSAnQGF3cy1jZGsvYXdzLWlhbSc7XG5pbXBvcnQgeyBUYWJsZSB9IGZyb20gJ0Bhd3MtY2RrL2F3cy1keW5hbW9kYic7XG5pbXBvcnQgTGFtYmRhID0gcmVxdWlyZSgnQGF3cy1jZGsvYXdzLWxhbWJkYScpO1xuaW1wb3J0IHsgS2luZXNpc0V2ZW50U291cmNlLCBBcGlFdmVudFNvdXJjZSB9IGZyb20gJ0Bhd3MtY2RrL2F3cy1sYW1iZGEtZXZlbnQtc291cmNlcyc7XG5cbmV4cG9ydCBjbGFzcyBJbmdlc3Rpb25Db25zdW1wdGlvbkxheWVyIGV4dGVuZHMgUmVzb3VyY2VBd2FyZUNvbnN0cnVjdCB7XG5cbiAgICBraW5lc2lzU3RyZWFtczogS0RTLlN0cmVhbTtcbiAgICBraW5lc2lzRmlyZWhvc2U6IEtERi5DZm5EZWxpdmVyeVN0cmVhbTtcbiAgICBwcml2YXRlIHJhd2J1Y2tldGFybjogc3RyaW5nO1xuICAgIHByaXZhdGUgdXNlcnBvb2w6IHN0cmluZztcbiAgICBwcml2YXRlIGFwaTogQVBJR1RXLkNmblJlc3RBcGk7XG5cbiAgICBjb25zdHJ1Y3RvcihwYXJlbnQ6IENvbnN0cnVjdCwgbmFtZTogc3RyaW5nLCBwcm9wczogSVBhcmFtZXRlckF3YXJlUHJvcHMpIHtcbiAgICAgICAgc3VwZXIocGFyZW50LCBuYW1lLCBwcm9wcyk7XG4gICAgICAgIHRoaXMucmF3YnVja2V0YXJuID0gcHJvcHMuZ2V0UGFyYW1ldGVyKCdyYXdidWNrZXRhcm4nKTtcbiAgICAgICAgdGhpcy51c2VycG9vbCA9IHByb3BzLmdldFBhcmFtZXRlcigndXNlcnBvb2wnKTtcbiAgICAgICAgdGhpcy5jcmVhdGVLaW5lc2lzKHByb3BzKTtcbiAgICAgICAgdGhpcy5jcmVhdGVBUElHYXRld2F5KHByb3BzKTtcbiAgICAgICAgdGhpcy51cGRhdGVVc2Vyc1JvbGVzKHByb3BzKTtcbiAgICB9XG5cbiAgICBjcmVhdGVLaW5lc2lzKHByb3BzOiBJUGFyYW1ldGVyQXdhcmVQcm9wcykge1xuXG4gICAgICAgIHRoaXMua2luZXNpc1N0cmVhbXMgPSBuZXcgS0RTLlN0cmVhbSh0aGlzLCBwcm9wcy5nZXRBcHBSZWZOYW1lKCkgKyAnSW5wdXRTdHJlYW0nLCB7XG4gICAgICAgICAgICBzdHJlYW1OYW1lOiBwcm9wcy5nZXRBcHBSZWZOYW1lKCkgKyAnX0lucHV0U3RyZWFtJyxcbiAgICAgICAgICAgIHNoYXJkQ291bnQ6IDFcbiAgICAgICAgfSk7XG5cbiAgICAgICAgKDxMYW1iZGEuRnVuY3Rpb24+IHByb3BzLmdldFBhcmFtZXRlcignbGFtYmRhLnNjb3JlYm9hcmQnKSkuYWRkRXZlbnRTb3VyY2UoXG5cbiAgICAgICAgICAgICAgIG5ldyBLaW5lc2lzRXZlbnRTb3VyY2UodGhpcy5raW5lc2lzU3RyZWFtcywge1xuICAgICAgICAgICAgICAgIGJhdGNoU2l6ZSA6IDcwMCxcbiAgICAgICAgICAgICAgICBzdGFydGluZ1Bvc2l0aW9uIDogTGFtYmRhLlN0YXJ0aW5nUG9zaXRpb24uTGF0ZXN0XG4gICAgICAgICAgICAgICB9KVxuICAgICAgICApO1xuXG4gICAgICAgIGxldCBmaXJlaG9zZUxvZ0dyb3VwID0gJy9hd3Mva2luZXNpc2ZpcmVob3NlLycgKyAoKHByb3BzLmdldEFwcFJlZk5hbWUoKSArICdmaXJlaG9zZScpLnRvTG93ZXJDYXNlKCkpO1xuICAgICAgICBsZXQgc2VsZiA9IHRoaXM7XG4gICAgICAgIGxldCBmaXJlaG9zZVJvbGUgPSBuZXcgSUFNLlJvbGUodGhpcywgcHJvcHMuZ2V0QXBwUmVmTmFtZSgpICsgJ0ZpcmVob3NlVG9TdHJlYW1zUm9sZScsIHtcbiAgICAgICAgICAgIHJvbGVOYW1lOiBwcm9wcy5nZXRBcHBSZWZOYW1lKCkgKyAnRmlyZWhvc2VUb1N0cmVhbXNSb2xlJyxcbiAgICAgICAgICAgIGFzc3VtZWRCeTogbmV3IElBTS5TZXJ2aWNlUHJpbmNpcGFsKCdmaXJlaG9zZS5hbWF6b25hd3MuY29tJyksXG4gICAgICAgICAgICBpbmxpbmVQb2xpY2llczoge1xuICAgICAgICAgICAgICAgICdTM1Jhd0RhdGFQZXJtaXNzaW9uJzogbmV3IFBvbGljeURvY3VtZW50KClcbiAgICAgICAgICAgICAgICAgICAgLmFkZFN0YXRlbWVudChuZXcgSUFNLlBvbGljeVN0YXRlbWVudCgpXG4gICAgICAgICAgICAgICAgICAgICAgICAuYWxsb3coKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmFkZEFjdGlvbignczM6QWJvcnRNdWx0aXBhcnRVcGxvYWQnKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmFkZEFjdGlvbignczM6R2V0QnVja2V0TG9jYXRpb24nKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmFkZEFjdGlvbignczM6R2V0T2JqZWN0JylcbiAgICAgICAgICAgICAgICAgICAgICAgIC5hZGRBY3Rpb24oJ3MzOkxpc3RCdWNrZXQnKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmFkZEFjdGlvbignczM6TGlzdEJ1Y2tldE11bHRpcGFydFVwbG9hZHMnKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmFkZEFjdGlvbignczM6UHV0T2JqZWN0JylcbiAgICAgICAgICAgICAgICAgICAgICAgIC5hZGRSZXNvdXJjZShzZWxmLnJhd2J1Y2tldGFybilcbiAgICAgICAgICAgICAgICAgICAgICAgIC5hZGRSZXNvdXJjZShzZWxmLnJhd2J1Y2tldGFybiArICcvKicpXG4gICAgICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgICAsXG4gICAgICAgICAgICAgICAgJ0lucHV0U3RyZWFtUmVhZFBlcm1pc3Npb25zJzogbmV3IFBvbGljeURvY3VtZW50KClcbiAgICAgICAgICAgICAgICAgICAgLmFkZFN0YXRlbWVudChuZXcgSUFNLlBvbGljeVN0YXRlbWVudCgpXG4gICAgICAgICAgICAgICAgICAgICAgICAuYWxsb3coKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmFkZEFjdGlvbigna2luZXNpczpEZXNjcmliZVN0cmVhbScpXG4gICAgICAgICAgICAgICAgICAgICAgICAuYWRkQWN0aW9uKCdraW5lc2lzOkdldFNoYXJkSXRlcmF0b3InKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmFkZEFjdGlvbigna2luZXNpczpHZXRSZWNvcmRzJylcbiAgICAgICAgICAgICAgICAgICAgICAgIC5hZGRSZXNvdXJjZSh0aGlzLmtpbmVzaXNTdHJlYW1zLnN0cmVhbUFybilcbiAgICAgICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICAgIC8qLFxuICAgICAgICAgICAgICAgIC8vIGlmIHMzIGVuY3J5cHRpb24gaXMgY29uZmlndXJlZFxuICAgICAgICAgICAgICAgICdEZWNyeXB0aW9uUGVybWlzc2lvbnMnOiBuZXcgUG9saWN5RG9jdW1lbnQoKVxuICAgICAgICAgICAgICAgICAgICAuYWRkU3RhdGVtZW50KG5ldyBJQU0uUG9saWN5U3RhdGVtZW50KClcbiAgICAgICAgICAgICAgICAgICAgICAgIC5hbGxvdygpXG4gICAgICAgICAgICAgICAgICAgICAgICAuYWRkQWN0aW9uKCdrbXM6RGVjcnlwdCcpXG4gICAgICAgICAgICAgICAgICAgICAgICAuYWRkQWN0aW9uKCdrbXM6R2VuZXJhdGVEYXRhS2V5JylcbiAgICAgICAgICAgICAgICAgICAgICAgIC5hZGRSZXNvdXJjZSgnYXJuOmF3czprbXM6Jytwcm9wcy5yZWdpb24rJzonK3Byb3BzLmFjY291bnRJZCsnOmtleS9hd3MvczMnKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmFkZENvbmRpdGlvbignU3RyaW5nRXF1YWxzJywge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICdrbXM6VmlhU2VydmljZSc6ICdraW5lc2lzLicgKyBwcm9wcy5yZWdpb24gKyAnLmFtYXpvbmF3cy5jb20nXG4gICAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAgICAgLmFkZENvbmRpdGlvbignU3RyaW5nTGlrZScse1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICdrbXM6RW5jcnlwdGlvbkNvbnRleHQ6YXdzOnMzOmFybicgOiAnYXJuOmF3czpzMzo6OicrcHJvcHMuczNCdWNrZXRSYXdEYXRhQXJuKycvKidcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgICAgICAgKi9cbiAgICAgICAgICAgICAgICAsXG4gICAgICAgICAgICAgICAgJ0dsdWVQZXJtaXNzaW9ucyc6IG5ldyBQb2xpY3lEb2N1bWVudCgpXG4gICAgICAgICAgICAgICAgICAgIC5hZGRTdGF0ZW1lbnQobmV3IElBTS5Qb2xpY3lTdGF0ZW1lbnQoKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmFsbG93KClcbiAgICAgICAgICAgICAgICAgICAgICAgIC5hZGRBbGxSZXNvdXJjZXMoKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmFkZEFjdGlvbignZ2x1ZTpHZXRUYWJsZVZlcnNpb25zJylcbiAgICAgICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICAgICxcbiAgICAgICAgICAgICAgICAnQ2xvdWRXYXRjaExvZ3NQZXJtaXNzaW9ucyc6IG5ldyBQb2xpY3lEb2N1bWVudCgpXG4gICAgICAgICAgICAgICAgICAgIC5hZGRTdGF0ZW1lbnQobmV3IElBTS5Qb2xpY3lTdGF0ZW1lbnQoKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmFsbG93KClcbiAgICAgICAgICAgICAgICAgICAgICAgIC5hZGRBY3Rpb24oJ2xvZ3M6UHV0TG9nRXZlbnRzJylcbiAgICAgICAgICAgICAgICAgICAgICAgIC5hZGRSZXNvdXJjZSgnYXJuOmF3czpsb2dzOicgKyBwcm9wcy5yZWdpb24gKyAnOicgKyBwcm9wcy5hY2NvdW50SWQgKyAnOmxvZy1ncm91cDonICsgZmlyZWhvc2VMb2dHcm91cCArICc6KjoqJylcbiAgICAgICAgICAgICAgICAgICAgICAgIC5hZGRSZXNvdXJjZSgnYXJuOmF3czpsb2dzOicgKyBwcm9wcy5yZWdpb24gKyAnOicgKyBwcm9wcy5hY2NvdW50SWQgKyAnOmxvZy1ncm91cDonICsgZmlyZWhvc2VMb2dHcm91cClcbiAgICAgICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICAgIC8qICxcbiAgICAgICAgICAgICAgICAgIC8vIGlmIHJlY29yZCB0cmFuc2Zvcm1hdGlvbiBpcyBzZWxlY3RlZFxuICAgICAgICAgICAgICAgICAnSW50ZXJuYWxMYW1iZGFJbnZvY2F0aW9uUGVybWlzc2lvbnMnIDogbmV3IFBvbGljeURvY3VtZW50KClcbiAgICAgICAgICAgICAgICAgICAgIC5hZGRTdGF0ZW1lbnQoIG5ldyBJQU0uUG9saWN5U3RhdGVtZW50KClcbiAgICAgICAgICAgICAgICAgICAgICAgICAuYWxsb3coKVxuICAgICAgICAgICAgICAgICAgICAgICAgIC5hZGRBY3Rpb24oJ2xhbWJkYTpJbnZva2VGdW5jdGlvbicpXG4gICAgICAgICAgICAgICAgICAgICAgICAgLmFkZEFjdGlvbignbGFtYmRhOkdldEZ1bmN0aW9uQ29uZmlndXJhdGlvbicpXG4gICAgICAgICAgICAgICAgICAgICAgICAgLmFkZFJlc291cmNlKCdhcm46YXdzOmxhbWJkYTonK3Byb3BzLnJlZ2lvbisnOicrcHJvcHMuYWNjb3VudElkKyc6ZnVuY3Rpb246JUZJUkVIT1NFX0RFRkFVTFRfRlVOQ1RJT04lOiVGSVJFSE9TRV9ERUZBVUxUX1ZFUlNJT04lJylcbiAgICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICAgICAgICAgICAgICovXG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRoaXMua2luZXNpc0ZpcmVob3NlID0gbmV3IEtERi5DZm5EZWxpdmVyeVN0cmVhbSh0aGlzLCBwcm9wcy5nZXRBcHBSZWZOYW1lKCkgKyAnUmF3RGF0YScsIHtcbiAgICAgICAgICAgIGRlbGl2ZXJ5U3RyZWFtVHlwZTogJ0tpbmVzaXNTdHJlYW1Bc1NvdXJjZScsXG4gICAgICAgICAgICBkZWxpdmVyeVN0cmVhbU5hbWU6IHByb3BzLmdldEFwcFJlZk5hbWUoKSArICdGaXJlaG9zZScsXG4gICAgICAgICAgICBraW5lc2lzU3RyZWFtU291cmNlQ29uZmlndXJhdGlvbjoge1xuICAgICAgICAgICAgICAgIGtpbmVzaXNTdHJlYW1Bcm46IHRoaXMua2luZXNpc1N0cmVhbXMuc3RyZWFtQXJuLFxuICAgICAgICAgICAgICAgIHJvbGVBcm46IGZpcmVob3NlUm9sZS5yb2xlQXJuXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAsIHMzRGVzdGluYXRpb25Db25maWd1cmF0aW9uOiB7XG4gICAgICAgICAgICAgICAgYnVja2V0QXJuOiA8c3RyaW5nPnRoaXMucmF3YnVja2V0YXJuLFxuICAgICAgICAgICAgICAgIGJ1ZmZlcmluZ0hpbnRzOiB7XG4gICAgICAgICAgICAgICAgICAgIGludGVydmFsSW5TZWNvbmRzOiA5MDAsXG4gICAgICAgICAgICAgICAgICAgIHNpemVJbk1CczogMTBcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIGNvbXByZXNzaW9uRm9ybWF0OiAnR1pJUCcsXG4gICAgICAgICAgICAgICAgcm9sZUFybjogZmlyZWhvc2VSb2xlLnJvbGVBcm4sXG4gICAgICAgICAgICAgICAgY2xvdWRXYXRjaExvZ2dpbmdPcHRpb25zOiB7XG4gICAgICAgICAgICAgICAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIGxvZ0dyb3VwTmFtZTogZmlyZWhvc2VMb2dHcm91cCxcbiAgICAgICAgICAgICAgICAgICAgbG9nU3RyZWFtTmFtZTogZmlyZWhvc2VMb2dHcm91cFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSlcbiAgICB9XG5cblxuICAgIGNyZWF0ZUFQSUdhdGV3YXkocHJvcHM6IElQYXJhbWV0ZXJBd2FyZVByb3BzKSB7XG5cbiAgICAgICAgbGV0IGFwaXJvbGUgPSBuZXcgSUFNLlJvbGUodGhpcywgcHJvcHMuZ2V0QXBwUmVmTmFtZSgpICsgJ0FQSVJvbGUnLCB7XG4gICAgICAgICAgICByb2xlTmFtZTogcHJvcHMuZ2V0QXBwUmVmTmFtZSgpICsgJ0FQSSdcbiAgICAgICAgICAgICwgYXNzdW1lZEJ5OiBuZXcgSUFNLlNlcnZpY2VQcmluY2lwYWwoJ2FwaWdhdGV3YXkuYW1hem9uYXdzLmNvbScpXG4gICAgICAgICAgICAsIGlubGluZVBvbGljaWVzOiB7XG4gICAgICAgICAgICAgICAgJ0xhbWJkYVBlcm1pc3Npb25zJzpcbiAgICAgICAgICAgICAgICAgICAgbmV3IFBvbGljeURvY3VtZW50KClcbiAgICAgICAgICAgICAgICAgICAgICAgIC5hZGRTdGF0ZW1lbnQoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbmV3IElBTS5Qb2xpY3lTdGF0ZW1lbnQoKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuYWxsb3coKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuYWRkQWN0aW9uKCdsYW1iZGE6SW52b2tlRnVuY3Rpb24nKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuYWRkQWN0aW9uKCdsYW1iZGE6SW52b2tlQXN5bmMnKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuYWRkUmVzb3VyY2UoJ2Fybjphd3M6bGFtYmRhOicgKyBwcm9wcy5yZWdpb24gKyAnOicgKyBwcm9wcy5hY2NvdW50SWQgKyAnOmZ1bmN0aW9uOicgKyBwcm9wcy5nZXRBcHBSZWZOYW1lKCkgKyAnKicpXG4gICAgICAgICAgICAgICAgICAgICAgICApLFxuICAgICAgICAgICAgICAgICdTU01QZXJtaXNzaW9ucyc6XG4gICAgICAgICAgICAgICAgICAgIG5ldyBQb2xpY3lEb2N1bWVudCgpXG4gICAgICAgICAgICAgICAgICAgICAgICAuYWRkU3RhdGVtZW50KFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5ldyBJQU0uUG9saWN5U3RhdGVtZW50KClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLmFsbG93KClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLmFkZEFjdGlvbnMoXCJzc206R2V0UGFyYW1ldGVySGlzdG9yeVwiKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuYWRkQWN0aW9uKFwic3NtOkdldFBhcmFtZXRlcnNCeVBhdGhcIilcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLmFkZEFjdGlvbihcInNzbTpHZXRQYXJhbWV0ZXJzXCIpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5hZGRBY3Rpb24oXCJzc206R2V0UGFyYW1ldGVyXCIpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5hZGRSZXNvdXJjZSgnYXJuOmF3czpzc206Jy5jb25jYXQocHJvcHMucmVnaW9uISwgJzonLCBwcm9wcy5hY2NvdW50SWQhLCAnOnBhcmFtZXRlci8nLCBwcm9wcy5nZXRBcHBSZWZOYW1lKCkudG9Mb3dlckNhc2UoKSwgJy8qJykpXG4gICAgICAgICAgICAgICAgICAgICAgICApLFxuICAgICAgICAgICAgICAgICdEeW5hbW9EQlBlcm1pc3Npb25zJzpcbiAgICAgICAgICAgICAgICAgICAgbmV3IFBvbGljeURvY3VtZW50KClcbiAgICAgICAgICAgICAgICAgICAgICAgIC5hZGRTdGF0ZW1lbnQoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbmV3IElBTS5Qb2xpY3lTdGF0ZW1lbnQoKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuYWxsb3coKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuYWRkQWN0aW9uKCdkeW5hbW9kYjpHZXRJdGVtJylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLmFkZFJlc291cmNlcyhcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAoPFRhYmxlPnByb3BzLmdldFBhcmFtZXRlcigndGFibGUuc2Vzc2lvbicpKS50YWJsZUFyblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLCg8VGFibGU+cHJvcHMuZ2V0UGFyYW1ldGVyKCd0YWJsZS5zZXNzaW9udG9weCcpKS50YWJsZUFyblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgICAgICAgICApLFxuICAgICAgICAgICAgICAgICdLaW5lc2lzUGVybWlzc2lvbnMnOlxuICAgICAgICAgICAgICAgICAgICBuZXcgUG9saWN5RG9jdW1lbnQoKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmFkZFN0YXRlbWVudChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBuZXcgSUFNLlBvbGljeVN0YXRlbWVudCgpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5hZGRBY3Rpb24oJ2tpbmVzaXM6UHV0UmVjb3JkJylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLmFkZEFjdGlvbigna2luZXNpczpQdXRSZWNvcmRzJylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLmFkZFJlc291cmNlKHRoaXMua2luZXNpc1N0cmVhbXMuc3RyZWFtQXJuKVxuICAgICAgICAgICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgYXBpcm9sZS5hdHRhY2hNYW5hZ2VkUG9saWN5KCdhcm46YXdzOmlhbTo6YXdzOnBvbGljeS9zZXJ2aWNlLXJvbGUvQW1hem9uQVBJR2F0ZXdheVB1c2hUb0Nsb3VkV2F0Y2hMb2dzJyk7XG5cbiAgICAgICAgdGhpcy5hcGkgPSBuZXcgQVBJR1RXLkNmblJlc3RBcGkodGhpcywgcHJvcHMuZ2V0QXBwUmVmTmFtZSgpICsgXCJBUElcIiwge1xuICAgICAgICAgICAgICBuYW1lOiBwcm9wcy5nZXRBcHBSZWZOYW1lKCkudG9Mb3dlckNhc2UoKVxuICAgICAgICAgICAgLCBkZXNjcmlwdGlvbjogJ0FQSSBzdXBwb3J0aW5nIHRoZSBhcHBsaWNhdGlvbiAnICsgcHJvcHMuZ2V0QXBwUmVmTmFtZSgpXG5cbiAgICAgICAgfSk7XG5cbiAgICAgICAgbmV3IEFQSUdUVy5DZm5HYXRld2F5UmVzcG9uc2UodGhpcyxwcm9wcy5nZXRBcHBSZWZOYW1lKCkrJ0dUV1Jlc3BvbnNlJywge1xuICAgICAgICAgICAgcmVzdEFwaUlkIDogdGhpcy5hcGkucmVzdEFwaUlkXG4gICAgICAgICAgICAscmVzcG9uc2VUeXBlIDogJ0RFRkFVTFRfNFhYJ1xuICAgICAgICAgICAgLHJlc3BvbnNlUGFyYW1ldGVycyA6IHtcbiAgICAgICAgICAgIFwiZ2F0ZXdheXJlc3BvbnNlLmhlYWRlci5BY2Nlc3MtQ29udHJvbC1BbGxvdy1IZWFkZXJzXCI6IFwiJ0NvbnRlbnQtVHlwZSxYLUFtei1EYXRlLEF1dGhvcml6YXRpb24sWC1BcGktS2V5LFgtQW16LVNlY3VyaXR5LVRva2VuJ1wiLFxuICAgICAgICAgICAgXCJnYXRld2F5cmVzcG9uc2UuaGVhZGVyLkFjY2Vzcy1Db250cm9sLUFsbG93LU1ldGhvZHNcIjogXCInKidcIixcbiAgICAgICAgICAgIFwiZ2F0ZXdheXJlc3BvbnNlLmhlYWRlci5BY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW5cIjogXCInKidcIlxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLHJlc3BvbnNlVGVtcGxhdGVzIDoge1xuICAgICAgICAgICAgXCJhcHBsaWNhdGlvbi9qc29uXCI6IFwie1xcXCJtZXNzYWdlXFxcIjokY29udGV4dC5lcnJvci5tZXNzYWdlU3RyaW5nfVwiXG4gICAgICAgICAgICB9XG4gICAgICAgIH0pLmFkZERlcGVuZHNPbih0aGlzLmFwaSk7XG5cbiAgICAgICAgbGV0IGF1dGhvcml6ZXIgPSBuZXcgQVBJR1RXLkNmbkF1dGhvcml6ZXIodGhpcywgcHJvcHMuZ2V0QXBwUmVmTmFtZSgpICsgXCJBdXRob3JpemVyXCIsIHtcbiAgICAgICAgICAgIG5hbWU6IHByb3BzLmdldEFwcFJlZk5hbWUoKS50b0xvd2VyQ2FzZSgpICsgJ0F1dGhvcml6ZXInXG4gICAgICAgICAgICAsIHJlc3RBcGlJZDogdGhpcy5hcGkucmVzdEFwaUlkXG4gICAgICAgICAgICAsIHR5cGU6ICdDT0dOSVRPX1VTRVJfUE9PTFMnXG4gICAgICAgICAgICAsIGlkZW50aXR5U291cmNlOiAnbWV0aG9kLnJlcXVlc3QuaGVhZGVyLkF1dGhvcml6YXRpb24nXG4gICAgICAgICAgICAsIHByb3ZpZGVyQXJuczogW1xuICAgICAgICAgICAgICAgIHRoaXMudXNlcnBvb2xcbiAgICAgICAgICAgIF1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgbGV0IGFwaU1vZGVsU2NvcmVib2FyZFJlc3BvbnNlID0gbmV3IEFQSUdUVy5DZm5Nb2RlbCh0aGlzLCBwcm9wcy5nZXRBcHBSZWZOYW1lKCkgKyAnQVBJTW9kZWxTY29yZWJvYXJkUmVzcG9uc2VNb2RlbCcsIHtcbiAgICAgICAgICAgIGNvbnRlbnRUeXBlOiAnYXBwbGljYXRpb24vanNvbidcbiAgICAgICAgICAgICwgZGVzY3JpcHRpb246ICdTY29yZWJvYXJkIHJlc3BvbnNlIG1vZGVsIChmb3IgL3Njb3JlYm9hcmQvR0VUKSdcbiAgICAgICAgICAgICwgbmFtZTogJ1Njb3JlYm9hcmRSZXNwb25zZU1vZGVsJ1xuICAgICAgICAgICAgLCByZXN0QXBpSWQ6IHRoaXMuYXBpLnJlc3RBcGlJZFxuICAgICAgICAgICAgLCBzY2hlbWE6IHtcbiAgICAgICAgICAgICAgICBcIiRzY2hlbWFcIjogXCJodHRwOi8vanNvbi1zY2hlbWEub3JnL2RyYWZ0LTA0L3NjaGVtYSNcIixcbiAgICAgICAgICAgICAgICBcInRpdGxlXCI6IFwiU2NvcmVib2FyZFJlc3BvbnNlTW9kZWxcIixcbiAgICAgICAgICAgICAgICBcInR5cGVcIjogXCJvYmplY3RcIixcbiAgICAgICAgICAgICAgICBcInByb3BlcnRpZXNcIjoge1xuICAgICAgICAgICAgICAgICAgICBcIlNjb3JlYm9hcmRcIjoge1xuICAgICAgICAgICAgICAgICAgICAgICAgXCJ0eXBlXCI6IFwiYXJyYXlcIixcbiAgICAgICAgICAgICAgICAgICAgICAgIFwiaXRlbXNcIjoge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiJHJlZlwiOiBcIiMvZGVmaW5pdGlvbnMvR2FtZXJTY29yZVwiXG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIFwiZGVmaW5pdGlvbnNcIjoge1xuICAgICAgICAgICAgICAgICAgICBcIkdhbWVyU2NvcmVcIjoge1xuICAgICAgICAgICAgICAgICAgICAgICAgXCJ0eXBlXCI6IFwib2JqZWN0XCIsXG4gICAgICAgICAgICAgICAgICAgICAgICBcInByb3BlcnRpZXNcIjoge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiTmFtZVwiOiB7IFwidHlwZVwiOiBcImludGVnZXJcIiB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiU2NvcmVcIjogeyBcInR5cGVcIjogXCJpbnRlZ2VyXCIgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBcIkxldmVsXCI6IHsgXCJ0eXBlXCI6IFwiaW50ZWdlclwiIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJTaG90c1wiOiB7IFwidHlwZVwiOiBcImludGVnZXJcIiB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiTmlja25hbWVcIjogeyBcInR5cGVcIjogXCJzdHJpbmdcIiB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiTGl2ZXNcIjogeyBcInR5cGVcIjogXCJpbnRlZ2VyXCIgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICBsZXQgYXBpTW9kZWxHZXRQYXJhbWV0ZXJzUmVxdWVzdCA9IG5ldyBBUElHVFcuQ2ZuTW9kZWwodGhpcywgcHJvcHMuZ2V0QXBwUmVmTmFtZSgpICsgJ0FQSU1vZGVsR2V0UGFyYW1ldGVyc1JlcXVlc3QnLCB7XG4gICAgICAgICAgICBjb250ZW50VHlwZTogJ2FwcGxpY2F0aW9uL2pzb24nXG4gICAgICAgICAgICAsIGRlc2NyaXB0aW9uOiAnTW9kZWwgdG8gcmVxdWVzdCBTU006R2V0UGFyYW1ldGVycydcbiAgICAgICAgICAgICwgbmFtZTogJ0dldFBhcmFtZXRlcnNSZXF1ZXN0J1xuICAgICAgICAgICAgLCByZXN0QXBpSWQ6IHRoaXMuYXBpLnJlc3RBcGlJZFxuICAgICAgICAgICAgLCBzY2hlbWE6IHtcbiAgICAgICAgICAgICAgICBcIiRzY2hlbWFcIjogXCJodHRwOi8vanNvbi1zY2hlbWEub3JnL2RyYWZ0LTA0L3NjaGVtYSNcIixcbiAgICAgICAgICAgICAgICBcInRpdGxlXCI6IFwiR2V0UGFyYW1ldGVyc1JlcXVlc3RcIixcbiAgICAgICAgICAgICAgICBcInR5cGVcIjogXCJvYmplY3RcIixcbiAgICAgICAgICAgICAgICBcInByb3BlcnRpZXNcIjoge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVzXCI6IHsgXCJ0eXBlXCI6IFwiYXJyYXlcIiB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICAvL1ZlcnNpb24gMSBvZiB0aGUgQVBJXG4gICAgICAgIGxldCB2MSA9IG5ldyBBUElHVFcuQ2ZuUmVzb3VyY2UodGhpcywgcHJvcHMuZ2V0QXBwUmVmTmFtZSgpICsgXCJBUEl2MVwiLCB7XG4gICAgICAgICAgICBwYXJlbnRJZDogdGhpcy5hcGkucmVzdEFwaVJvb3RSZXNvdXJjZUlkXG4gICAgICAgICAgICAsIHBhdGhQYXJ0OiAndjEnXG4gICAgICAgICAgICAsIHJlc3RBcGlJZDogdGhpcy5hcGkucmVzdEFwaUlkXG4gICAgICAgIH0pO1xuXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogU0VTU0lPTiByZXNvdXJjZSAvc2Vzc2lvblxuICAgICAgICAgKiBHRVQge25vIHBhcmFtZXRlcn0gLSByZXR1cm5zIHNlc3Npb24gZGF0YSBmcm9tIHNzbS5wYXJhbWV0ZXIgL3NzbS9zZXNzaW9uXG4gICAgICAgICAqIFxuICAgICAgICAgKi9cblxuICAgICAgICBsZXQgc2Vzc2lvbiA9IG5ldyBBUElHVFcuQ2ZuUmVzb3VyY2UodGhpcywgcHJvcHMuZ2V0QXBwUmVmTmFtZSgpICsgXCJBUEl2MXNlc3Npb25cIiwge1xuICAgICAgICAgICAgcGFyZW50SWQ6IHYxLnJlc291cmNlSWRcbiAgICAgICAgICAgICwgcGF0aFBhcnQ6ICdzZXNzaW9uJ1xuICAgICAgICAgICAgLCByZXN0QXBpSWQ6IHRoaXMuYXBpLnJlc3RBcGlJZFxuICAgICAgICB9KTtcblxuICAgICAgICBsZXQgc2Vzc2lvbkdldE1ldGhvZCA9IG5ldyBBUElHVFcuQ2ZuTWV0aG9kKHRoaXMsIHByb3BzLmdldEFwcFJlZk5hbWUoKSArIFwiQVBJdjFzZXNzaW9uR0VUXCIsIHtcbiAgICAgICAgICAgIHJlc3RBcGlJZDogdGhpcy5hcGkucmVzdEFwaUlkXG4gICAgICAgICAgICAsIHJlc291cmNlSWQ6IHNlc3Npb24ucmVzb3VyY2VJZFxuICAgICAgICAgICAgLCBhdXRob3JpemF0aW9uVHlwZTogQVBJR1RXLkF1dGhvcml6YXRpb25UeXBlLkNvZ25pdG9cbiAgICAgICAgICAgICwgYXV0aG9yaXplcklkOiBhdXRob3JpemVyLmF1dGhvcml6ZXJJZFxuICAgICAgICAgICAgLCBodHRwTWV0aG9kOiAnR0VUJ1xuICAgICAgICAgICAgLCByZXF1ZXN0UGFyYW1ldGVyczoge1xuICAgICAgICAgICAgICAgICAgJ21ldGhvZC5yZXF1ZXN0LnF1ZXJ5c3RyaW5nLk5hbWUnOiB0cnVlXG4gICAgICAgICAgICAgICAgLCAnbWV0aG9kLnJlcXVlc3QuaGVhZGVyLkF1dGhlbnRpY2F0aW9uJzogdHJ1ZVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLCByZXF1ZXN0TW9kZWxzIDogdW5kZWZpbmVkXG4gICAgICAgICAgICAsIGludGVncmF0aW9uOiB7XG4gICAgICAgICAgICAgICAgcGFzc3Rocm91Z2hCZWhhdmlvcjogJ1dIRU5fTk9fTUFUQ0gnXG4gICAgICAgICAgICAgICAgLCBpbnRlZ3JhdGlvbkh0dHBNZXRob2Q6ICdQT1NUJ1xuICAgICAgICAgICAgICAgICwgdHlwZTogJ0FXUydcbiAgICAgICAgICAgICAgICAsIHVyaTogJ2Fybjphd3M6YXBpZ2F0ZXdheTonICsgcHJvcHMucmVnaW9uICsgJzpzc206YWN0aW9uL0dldFBhcmFtZXRlcidcbiAgICAgICAgICAgICAgICAsIGNyZWRlbnRpYWxzOiBhcGlyb2xlLnJvbGVBcm5cbiAgICAgICAgICAgICAgICAsIHJlcXVlc3RQYXJhbWV0ZXJzOiB7XG4gICAgICAgICAgICAgICAgICAgICAgJ2ludGVncmF0aW9uLnJlcXVlc3QucXVlcnlzdHJpbmcuTmFtZSc6IFwiJy9cIiArIHByb3BzLmdldEFwcFJlZk5hbWUoKS50b0xvd2VyQ2FzZSgpICsgXCIvc2Vzc2lvbidcIlxuICAgICAgICAgICAgICAgICAgICAsICdpbnRlZ3JhdGlvbi5yZXF1ZXN0LmhlYWRlci5BdXRoZW50aWNhdGlvbic6ICdtZXRob2QucmVxdWVzdC5oZWFkZXIuQXV0aGVudGljYXRpb24nXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICwgcmVxdWVzdFRlbXBsYXRlcyA6IHVuZGVmaW5lZFxuICAgICAgICAgICAgICAgICwgaW50ZWdyYXRpb25SZXNwb25zZXM6IFtcbiAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgc3RhdHVzQ29kZTogJzIwMCdcbiAgICAgICAgICAgICAgICAgICAgICAgICwgcmVzcG9uc2VQYXJhbWV0ZXJzOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJ21ldGhvZC5yZXNwb25zZS5oZWFkZXIuQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luJzogXCInKidcIlxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgLCByZXNwb25zZVRlbXBsYXRlczoge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICdhcHBsaWNhdGlvbi9qc29uJzogYFwiJHV0aWwuZXNjYXBlSmF2YVNjcmlwdChcIiRpbnB1dC5wYXRoKCckJykuR2V0UGFyYW1ldGVyUmVzcG9uc2UuR2V0UGFyYW1ldGVyUmVzdWx0LlBhcmFtZXRlci5WYWx1ZVwiKS5yZXBsYWNlQWxsKFwiXFwnXCIsJ1wiJylcImBcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfV1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgICwgbWV0aG9kUmVzcG9uc2VzOiBbXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBzdGF0dXNDb2RlOiAnMjAwJ1xuICAgICAgICAgICAgICAgICAgICAsIHJlc3BvbnNlUGFyYW1ldGVyczoge1xuICAgICAgICAgICAgICAgICAgICAgICAgJ21ldGhvZC5yZXNwb25zZS5oZWFkZXIuQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luJzogZmFsc2VcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAsIHJlc3BvbnNlTW9kZWxzOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAnYXBwbGljYXRpb24vanNvbic6ICdFbXB0eSdcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIF1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gT1BUSU9OU1xuICAgICAgICBsZXQgc2Vzc2lvbk9wdGlvbnNNZXRob2QgPSBuZXcgQVBJR1RXLkNmbk1ldGhvZCh0aGlzLCBwcm9wcy5nZXRBcHBSZWZOYW1lKCkgKyBcIkFQSXYxc2Vzc2lvbk9QVElPTlNcIiwge1xuICAgICAgICAgICAgcmVzdEFwaUlkOiB0aGlzLmFwaS5yZXN0QXBpSWRcbiAgICAgICAgICAgICwgcmVzb3VyY2VJZDogc2Vzc2lvbi5yZXNvdXJjZUlkXG4gICAgICAgICAgICAsIGF1dGhvcml6YXRpb25UeXBlOiBBUElHVFcuQXV0aG9yaXphdGlvblR5cGUuTm9uZVxuICAgICAgICAgICAgLCBodHRwTWV0aG9kOiAnT1BUSU9OUydcbiAgICAgICAgICAgICwgaW50ZWdyYXRpb246IHtcbiAgICAgICAgICAgICAgICBwYXNzdGhyb3VnaEJlaGF2aW9yOiAnV0hFTl9OT19NQVRDSCdcbiAgICAgICAgICAgICAgICAsIHR5cGU6ICdNT0NLJ1xuICAgICAgICAgICAgICAgICwgcmVxdWVzdFRlbXBsYXRlczoge1xuICAgICAgICAgICAgICAgICAgICAnYXBwbGljYXRpb24vanNvbic6ICd7XFxcInN0YXR1c0NvZGVcXFwiOiAyMDB9J1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAsIGludGVncmF0aW9uUmVzcG9uc2VzOiBbXG4gICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0YXR1c0NvZGU6ICcyMDAnXG4gICAgICAgICAgICAgICAgICAgICAgICAsIHJlc3BvbnNlUGFyYW1ldGVyczoge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICdtZXRob2QucmVzcG9uc2UuaGVhZGVyLkFjY2Vzcy1Db250cm9sLUFsbG93LUhlYWRlcnMnIDogXCInQ29udGVudC1UeXBlLFgtQW16LURhdGUsQXV0aG9yaXphdGlvbixYLUFwaS1LZXksWC1BbXotU2VjdXJpdHktVG9rZW4nXCJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAsJ21ldGhvZC5yZXNwb25zZS5oZWFkZXIuQWNjZXNzLUNvbnRyb2wtQWxsb3ctTWV0aG9kcycgOiBcIicqJ1wiXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLCdtZXRob2QucmVzcG9uc2UuaGVhZGVyLkFjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpbicgOiBcIicqJ1wiXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLypcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICdtZXRob2QucmVzcG9uc2UuaGVhZGVyLkFjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpbic6IFwiJyonXCJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAsICdtZXRob2QucmVzcG9uc2UuaGVhZGVyLkFjY2Vzcy1Db250cm9sLUFsbG93LU1ldGhvZHMnOiBcIidHRVQsT1BUSU9OUydcIlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICwgJ21ldGhvZC5yZXNwb25zZS5oZWFkZXIuQWNjZXNzLUNvbnRyb2wtQWxsb3ctSGVhZGVycyc6IFwiJ0NvbnRlbnQtVHlwZSxBdXRob3JpemF0aW9uLFgtQW16LURhdGUsWC1BcGktS2V5LFgtQW16LVNlY3VyaXR5LVRva2VuJ1wiXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKi9cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfV1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgICwgbWV0aG9kUmVzcG9uc2VzOiBbXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBzdGF0dXNDb2RlOiAnMjAwJ1xuICAgICAgICAgICAgICAgICAgICAsIHJlc3BvbnNlUGFyYW1ldGVyczoge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAnbWV0aG9kLnJlc3BvbnNlLmhlYWRlci5BY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4nOiBmYWxzZVxuICAgICAgICAgICAgICAgICAgICAgICAgLCAnbWV0aG9kLnJlc3BvbnNlLmhlYWRlci5BY2Nlc3MtQ29udHJvbC1BbGxvdy1NZXRob2RzJzogZmFsc2VcbiAgICAgICAgICAgICAgICAgICAgICAgICwgJ21ldGhvZC5yZXNwb25zZS5oZWFkZXIuQWNjZXNzLUNvbnRyb2wtQWxsb3ctSGVhZGVycyc6IGZhbHNlXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgLCByZXNwb25zZU1vZGVsczoge1xuICAgICAgICAgICAgICAgICAgICAgICAgXCJhcHBsaWNhdGlvbi9qc29uXCI6ICdFbXB0eSdcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIF1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIENPTkZJRyBcbiAgICAgICAgICogUmVzb3VyY2U6IC9jb25maWdcbiAgICAgICAgICogTWV0aG9kOiBHRVQgXG4gICAgICAgICAqIFJlcXVlc3QgUGFyYW1ldGVycyA6IG5vbmVcbiAgICAgICAgICogUmVzcG9uc2UgZm9ybWF0OlxuICAgICAgICAgICAge1xuICAgICAgICAgICAgXCJQYXJhbWV0ZXJzXCI6IFtcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgXCJOYW1lXCI6IFwiLzxhcHA+L2NsaWVudGlkXCIsXG4gICAgICAgICAgICAgICAgXCJWYWx1ZVwiOiBcIjR0ZmU1bDI2a2RwNTl0YzRrNHYwYjY4OG5tXCJcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBcIk5hbWVcIjogXCIvPGFwcD4vaWRlbnRpdHlwb29saWRcIixcbiAgICAgICAgICAgICAgICBcIlZhbHVlXCI6IFwiPHJlZ2lvbj46MTcwOTJkZjYtN2UzYS00ODkzLTRkODUtYzZkZTMzY2RmYWJjXCJcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBcIk5hbWVcIjogXCIvPGFwcD4+L3VzZXJwb29saWRcIixcbiAgICAgICAgICAgICAgICBcIlZhbHVlXCI6IFwiPHJlZ2lvbj5fdWVMZmRhU1hpXCJcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBcIk5hbWVcIjogXCIvPGFwcD4+L3VzZXJwb29sdXJsXCIsXG4gICAgICAgICAgICAgICAgXCJWYWx1ZVwiOiBcImNvZ25pdG8taWRwLjxyZWdpb24+Pi5hbWF6b25hd3MuY29tLzxyZWdpb24+X3VlTGZkYVNYaVwiXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgXVxuICAgICAgICAgICAgfVxuICAgICAgICAgKi9cbiAgICAgICAgbGV0IGNvbmZpZyA9IG5ldyBBUElHVFcuQ2ZuUmVzb3VyY2UodGhpcywgcHJvcHMuZ2V0QXBwUmVmTmFtZSgpICsgXCJBUEl2MWNvbmZpZ1wiLCB7XG4gICAgICAgICAgICBwYXJlbnRJZDogdjEucmVzb3VyY2VJZFxuICAgICAgICAgICAgLCBwYXRoUGFydDogJ2NvbmZpZydcbiAgICAgICAgICAgICwgcmVzdEFwaUlkOiB0aGlzLmFwaS5yZXN0QXBpSWRcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gR0VUXG4gICAgICAgIGxldCBjb25maWdHZXRNZXRob2QgPSBuZXcgQVBJR1RXLkNmbk1ldGhvZCh0aGlzLCBwcm9wcy5nZXRBcHBSZWZOYW1lKCkgKyBcIkFQSXYxY29uZmlnR0VUXCIsIHtcbiAgICAgICAgICAgIHJlc3RBcGlJZDogdGhpcy5hcGkucmVzdEFwaUlkXG4gICAgICAgICAgICAsIHJlc291cmNlSWQ6IGNvbmZpZy5yZXNvdXJjZUlkXG4gICAgICAgICAgICAsIGF1dGhvcml6YXRpb25UeXBlOiBBUElHVFcuQXV0aG9yaXphdGlvblR5cGUuTm9uZVxuICAgICAgICAgICAgLCBodHRwTWV0aG9kOiAnR0VUJ1xuICAgICAgICAgICAgLCByZXF1ZXN0UGFyYW1ldGVyczoge1xuICAgICAgICAgICAgICAgICdtZXRob2QucmVxdWVzdC5oZWFkZXIuQ29udGVudC1UeXBlJzogdHJ1ZVxuICAgICAgICAgICAgICAgICwgJ21ldGhvZC5yZXF1ZXN0LmhlYWRlci5YLUFtei1UYXJnZXQnOiB0cnVlXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAsIHJlcXVlc3RNb2RlbHM6IHtcbiAgICAgICAgICAgICAgICAnYXBwbGljYXRpb24vanNvbic6IGFwaU1vZGVsR2V0UGFyYW1ldGVyc1JlcXVlc3QucmVmXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAsIGludGVncmF0aW9uOiB7XG4gICAgICAgICAgICAgICAgaW50ZWdyYXRpb25IdHRwTWV0aG9kOiAnUE9TVCdcbiAgICAgICAgICAgICAgICAsIHR5cGU6ICdBV1MnXG4gICAgICAgICAgICAgICAgLCB1cmk6ICdhcm46YXdzOmFwaWdhdGV3YXk6JyArIHByb3BzLnJlZ2lvbiArICc6c3NtOnBhdGgvLydcbiAgICAgICAgICAgICAgICAsIGNyZWRlbnRpYWxzOiBhcGlyb2xlLnJvbGVBcm5cbiAgICAgICAgICAgICAgICAsIHJlcXVlc3RQYXJhbWV0ZXJzOiB7XG4gICAgICAgICAgICAgICAgICAgICdpbnRlZ3JhdGlvbi5yZXF1ZXN0LmhlYWRlci5Db250ZW50LVR5cGUnOiBcIidhcHBsaWNhdGlvbi94LWFtei1qc29uLTEuMSdcIlxuICAgICAgICAgICAgICAgICAgICAsICdpbnRlZ3JhdGlvbi5yZXF1ZXN0LmhlYWRlci5YLUFtei1UYXJnZXQnOiBcIidBbWF6b25TU00uR2V0UGFyYW1ldGVycydcIlxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAsIHJlcXVlc3RUZW1wbGF0ZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgJ2FwcGxpY2F0aW9uL2pzb24nOiAne1wiTmFtZXNcIiA6IFsnICtcbiAgICAgICAgICAgICAgICAgICAgICAgICdcIi8nICsgcHJvcHMuZ2V0QXBwUmVmTmFtZSgpLnRvTG93ZXJDYXNlKCkgKyAnL3VzZXJwb29saWRcIiwnICtcbiAgICAgICAgICAgICAgICAgICAgICAgICdcIi8nICsgcHJvcHMuZ2V0QXBwUmVmTmFtZSgpLnRvTG93ZXJDYXNlKCkgKyAnL3VzZXJwb29sdXJsXCIsJyArXG4gICAgICAgICAgICAgICAgICAgICAgICAnXCIvJyArIHByb3BzLmdldEFwcFJlZk5hbWUoKS50b0xvd2VyQ2FzZSgpICsgJy9jbGllbnRpZFwiLCcgK1xuICAgICAgICAgICAgICAgICAgICAgICAgJ1wiLycgKyBwcm9wcy5nZXRBcHBSZWZOYW1lKCkudG9Mb3dlckNhc2UoKSArICcvaWRlbnRpdHlwb29saWRcIicgK1xuICAgICAgICAgICAgICAgICAgICAgICAgJ119J1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAsIHBhc3N0aHJvdWdoQmVoYXZpb3I6ICdXSEVOX05PX1RFTVBMQVRFUydcbiAgICAgICAgICAgICAgICAsIGludGVncmF0aW9uUmVzcG9uc2VzOiBbXG4gICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0YXR1c0NvZGU6ICcyMDAnXG4gICAgICAgICAgICAgICAgICAgICAgICAsIHJlc3BvbnNlUGFyYW1ldGVyczoge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICdtZXRob2QucmVzcG9uc2UuaGVhZGVyLkFjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpbic6IFwiJyonXCJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICwgcmVzcG9uc2VUZW1wbGF0ZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAnYXBwbGljYXRpb24vanNvbic6IGBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI3NldCgkaW5wdXRSb290ID0gJGlucHV0LnBhdGgoJyQnKSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJQYXJhbWV0ZXJzXCIgOiBbXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI2ZvcmVhY2goJGVsZW0gaW4gJGlucHV0Um9vdC5QYXJhbWV0ZXJzKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJOYW1lXCIgOiBcIiRlbGVtLk5hbWVcIixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJWYWx1ZVwiIDogIFwiJHV0aWwuZXNjYXBlSmF2YVNjcmlwdChcIiRlbGVtLlZhbHVlXCIpLnJlcGxhY2VBbGwoXCInXCIsJ1wiJylcIlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI2lmKCRmb3JlYWNoLmhhc05leHQpLCNlbmRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICNlbmRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9YFxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLCBtZXRob2RSZXNwb25zZXM6IFtcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIHN0YXR1c0NvZGU6ICcyMDAnXG4gICAgICAgICAgICAgICAgICAgICwgcmVzcG9uc2VQYXJhbWV0ZXJzOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAnbWV0aG9kLnJlc3BvbnNlLmhlYWRlci5BY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4nOiB0cnVlXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICwgcmVzcG9uc2VNb2RlbHM6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgJ2FwcGxpY2F0aW9uL2pzb24nOiAnRW1wdHknXG4gICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIF1cbiAgICAgICAgfSk7XG5cblxuICAgICAgICAvLyBPUFRJT05TXG4gICAgICAgIGxldCBjb25maWdPcHRpb25zTWV0aG9kID0gbmV3IEFQSUdUVy5DZm5NZXRob2QodGhpcywgcHJvcHMuZ2V0QXBwUmVmTmFtZSgpICsgXCJBUEl2MWNvbmZpZ09QVElPTlNcIiwge1xuICAgICAgICAgICAgcmVzdEFwaUlkOiB0aGlzLmFwaS5yZXN0QXBpSWRcbiAgICAgICAgICAgICwgcmVzb3VyY2VJZDogY29uZmlnLnJlc291cmNlSWRcbiAgICAgICAgICAgICwgYXV0aG9yaXphdGlvblR5cGU6IEFQSUdUVy5BdXRob3JpemF0aW9uVHlwZS5Ob25lXG4gICAgICAgICAgICAsIGh0dHBNZXRob2Q6ICdPUFRJT05TJ1xuICAgICAgICAgICAgLCBpbnRlZ3JhdGlvbjoge1xuICAgICAgICAgICAgICAgIHBhc3N0aHJvdWdoQmVoYXZpb3I6ICd3aGVuX25vX21hdGNoJ1xuICAgICAgICAgICAgICAgICwgdHlwZTogJ01PQ0snXG4gICAgICAgICAgICAgICAgLCByZXF1ZXN0VGVtcGxhdGVzOiB7XG4gICAgICAgICAgICAgICAgICAgICdhcHBsaWNhdGlvbi9qc29uJzogYHtcXFwic3RhdHVzQ29kZVxcXCI6IDIwMH1gXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICwgaW50ZWdyYXRpb25SZXNwb25zZXM6IFtcbiAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgc3RhdHVzQ29kZTogJzIwMCdcbiAgICAgICAgICAgICAgICAgICAgICAgICwgcmVzcG9uc2VQYXJhbWV0ZXJzOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICdtZXRob2QucmVzcG9uc2UuaGVhZGVyLkFjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpbic6IFwiJyonXCJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAsICdtZXRob2QucmVzcG9uc2UuaGVhZGVyLkFjY2Vzcy1Db250cm9sLUFsbG93LU1ldGhvZHMnOiBcIicqJ1wiXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLCAnbWV0aG9kLnJlc3BvbnNlLmhlYWRlci5BY2Nlc3MtQ29udHJvbC1BbGxvdy1IZWFkZXJzJzogXCInQ29udGVudC1UeXBlLEF1dGhvcml6YXRpb24sWC1BbXotRGF0ZSxYLUFwaS1LZXksWC1BbXotU2VjdXJpdHktVG9rZW4nXCJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfV1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgICwgbWV0aG9kUmVzcG9uc2VzOiBbXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBzdGF0dXNDb2RlOiAnMjAwJ1xuICAgICAgICAgICAgICAgICAgICAsIHJlc3BvbnNlUGFyYW1ldGVyczoge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAnbWV0aG9kLnJlc3BvbnNlLmhlYWRlci5BY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4nOiB0cnVlXG4gICAgICAgICAgICAgICAgICAgICAgICAsICdtZXRob2QucmVzcG9uc2UuaGVhZGVyLkFjY2Vzcy1Db250cm9sLUFsbG93LU1ldGhvZHMnOiB0cnVlXG4gICAgICAgICAgICAgICAgICAgICAgICAsICdtZXRob2QucmVzcG9uc2UuaGVhZGVyLkFjY2Vzcy1Db250cm9sLUFsbG93LUhlYWRlcnMnOiB0cnVlXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgLCByZXNwb25zZU1vZGVsczoge1xuICAgICAgICAgICAgICAgICAgICAgJ2FwcGxpY2F0aW9uL2pzb24nOiAnRW1wdHknXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICBdXG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBBTExPQ0FURSBcbiAgICAgICAgICogUmVzb3VyY2U6IC9hbGxvY2F0ZVxuICAgICAgICAgKiBNZXRob2Q6IFBPU1RcbiAgICAgICAgICogUmVxdWVzdCBmb3JtYXQ6IHsgJ1VzZXJuYW1lJyA6ICc8dGhlIHVzZXIgbmFtZT4nfVxuICAgICAgICAgKi9cbiAgICAgICAgbGV0IGFsbG9jYXRlID0gbmV3IEFQSUdUVy5DZm5SZXNvdXJjZSh0aGlzLCBwcm9wcy5nZXRBcHBSZWZOYW1lKCkgKyBcIkFQSXYxYWxsb2NhdGVcIiwge1xuICAgICAgICAgICAgcGFyZW50SWQ6IHYxLnJlc291cmNlSWRcbiAgICAgICAgICAgICwgcGF0aFBhcnQ6ICdhbGxvY2F0ZSdcbiAgICAgICAgICAgICwgcmVzdEFwaUlkOiB0aGlzLmFwaS5yZXN0QXBpSWRcbiAgICAgICAgfSk7XG5cblxuICAgICAgICBsZXQgbGFtYmRhQWxsb2NhdGUgPSAoPExhbWJkYS5GdW5jdGlvbj4gcHJvcHMuZ2V0UGFyYW1ldGVyKCdsYW1iZGEuYWxsb2NhdGUnKSk7XG5cbiAgICAgICAgLy8gUE9TVFxuICAgICAgICBsZXQgYWxsb2NhdGVQb3N0TWV0aG9kID0gbmV3IEFQSUdUVy5DZm5NZXRob2QodGhpcywgcHJvcHMuZ2V0QXBwUmVmTmFtZSgpICsgXCJBUEl2MWFsbG9jYXRlUE9TVFwiLCB7XG4gICAgICAgICAgICByZXN0QXBpSWQ6IHRoaXMuYXBpLnJlc3RBcGlJZFxuICAgICAgICAgICAgLCByZXNvdXJjZUlkOiBhbGxvY2F0ZS5yZXNvdXJjZUlkXG4gICAgICAgICAgICAsIGF1dGhvcml6YXRpb25UeXBlOiBBUElHVFcuQXV0aG9yaXphdGlvblR5cGUuQ29nbml0b1xuICAgICAgICAgICAgLCBhdXRob3JpemVySWQ6IGF1dGhvcml6ZXIuYXV0aG9yaXplcklkXG4gICAgICAgICAgICAsIGh0dHBNZXRob2Q6ICdQT1NUJ1xuICAgICAgICAgICAgLCBpbnRlZ3JhdGlvbjoge1xuICAgICAgICAgICAgICAgIHBhc3N0aHJvdWdoQmVoYXZpb3I6ICdXSEVOX05PX01BVENIJ1xuICAgICAgICAgICAgICAgICwgaW50ZWdyYXRpb25IdHRwTWV0aG9kOiAnUE9TVCdcbiAgICAgICAgICAgICAgICAsIHR5cGU6ICdBV1NfUFJPWFknXG4gICAgICAgICAgICAgICAgLCB1cmk6ICdhcm46YXdzOmFwaWdhdGV3YXk6JyArIHByb3BzLnJlZ2lvbiArICc6bGFtYmRhOnBhdGgvMjAxNS0wMy0zMS9mdW5jdGlvbnMvJyArIGxhbWJkYUFsbG9jYXRlLmZ1bmN0aW9uQXJuICsgJy9pbnZvY2F0aW9ucydcbiAgICAgICAgICAgICAgICAsIGNyZWRlbnRpYWxzOiBhcGlyb2xlLnJvbGVBcm5cbiAgICAgICAgICAgICAgLy8gICwgdXJpOiAnYXJuOmF3czphcGlnYXRld2F5OicgKyBwcm9wcy5yZWdpb24gKyAnOmxhbWJkYTpwYXRoLzIwMTUtMDMtMzEvZnVuY3Rpb25zLycgKyBwcm9wcy5nZXRQYXJhbWV0ZXIoJ2xhbWJkYS5hbGxvY2F0ZScpICsgJy9pbnZvY2F0aW9ucydcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgICwgbWV0aG9kUmVzcG9uc2VzOiBbXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBzdGF0dXNDb2RlOiAnMjAwJ1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIF1cbiAgICAgICAgfSk7XG5cbi8qIFRPIEJFIElNUExFTUVOVEVEIE9OIENES1xuICAgICAgICBsYW1iZGFBbGxvY2F0ZS5hZGRFdmVudFNvdXJjZShcbiAgICAgICAgICAgIG5ldyBBcGlFdmVudFNvdXJjZSggJ1BPU1QnLCcvdjEvYWxsb2NhdGUnLHtcbiAgICAgICAgICAgICAgICAgICBhdXRob3JpemF0aW9uVHlwZSA6IEFQSUdUVy5BdXRob3JpemF0aW9uVHlwZS5Db2duaXRvXG4gICAgICAgICAgICAgICAgICwgYXV0aG9yaXplcklkIDogYXV0aG9yaXplci5hdXRob3JpemVySWRcbiAgICAgICAgICAgIH0pXG4gICAgICAgICk7XG4qL1xuXG4gICAgICAgIC8vIE9QVElPTlNcbiAgICAgICAgbGV0IGFsbG9jYXRlT3B0aW9uc01ldGhvZCA9IG5ldyBBUElHVFcuQ2ZuTWV0aG9kKHRoaXMsIHByb3BzLmdldEFwcFJlZk5hbWUoKSArIFwiQVBJdjFhbGxvY2F0ZU9QVElPTlNcIiwge1xuICAgICAgICAgICAgcmVzdEFwaUlkOiB0aGlzLmFwaS5yZXN0QXBpSWRcbiAgICAgICAgICAgICwgcmVzb3VyY2VJZDogYWxsb2NhdGUucmVzb3VyY2VJZFxuICAgICAgICAgICAgLCBhdXRob3JpemF0aW9uVHlwZTogQVBJR1RXLkF1dGhvcml6YXRpb25UeXBlLk5vbmVcbiAgICAgICAgICAgICwgaHR0cE1ldGhvZDogJ09QVElPTlMnXG4gICAgICAgICAgICAsIGludGVncmF0aW9uOiB7XG4gICAgICAgICAgICAgICAgcGFzc3Rocm91Z2hCZWhhdmlvcjogJ1dIRU5fTk9fTUFUQ0gnXG4gICAgICAgICAgICAgICAgLCB0eXBlOiAnTU9DSydcbiAgICAgICAgICAgICAgICAsIHJlcXVlc3RUZW1wbGF0ZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgJ2FwcGxpY2F0aW9uL2pzb24nOiBge1xcXCJzdGF0dXNDb2RlXFxcIjogMjAwfWBcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLCBpbnRlZ3JhdGlvblJlc3BvbnNlczogW1xuICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzdGF0dXNDb2RlOiAnMjAwJ1xuICAgICAgICAgICAgICAgICAgICAgICAgLCByZXNwb25zZVBhcmFtZXRlcnM6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAnbWV0aG9kLnJlc3BvbnNlLmhlYWRlci5BY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4nOiBcIicqJ1wiXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLCAnbWV0aG9kLnJlc3BvbnNlLmhlYWRlci5BY2Nlc3MtQ29udHJvbC1BbGxvdy1NZXRob2RzJzogXCInKidcIlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICwgJ21ldGhvZC5yZXNwb25zZS5oZWFkZXIuQWNjZXNzLUNvbnRyb2wtQWxsb3ctSGVhZGVycyc6IFwiJ0NvbnRlbnQtVHlwZSxBdXRob3JpemF0aW9uLFgtQW16LURhdGUsWC1BcGktS2V5LFgtQW16LVNlY3VyaXR5LVRva2VuJ1wiXG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1dXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAsIG1ldGhvZFJlc3BvbnNlczogW1xuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgc3RhdHVzQ29kZTogJzIwMCdcbiAgICAgICAgICAgICAgICAgICAgLCByZXNwb25zZVBhcmFtZXRlcnM6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICdtZXRob2QucmVzcG9uc2UuaGVhZGVyLkFjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpbic6IHRydWVcbiAgICAgICAgICAgICAgICAgICAgICAgICwgJ21ldGhvZC5yZXNwb25zZS5oZWFkZXIuQWNjZXNzLUNvbnRyb2wtQWxsb3ctTWV0aG9kcyc6IHRydWVcbiAgICAgICAgICAgICAgICAgICAgICAgICwgJ21ldGhvZC5yZXNwb25zZS5oZWFkZXIuQWNjZXNzLUNvbnRyb2wtQWxsb3ctSGVhZGVycyc6IHRydWVcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAsIHJlc3BvbnNlTW9kZWxzOiB7XG4gICAgICAgICAgICAgICAgICAgICdhcHBsaWNhdGlvbi9qc29uJzogJ0VtcHR5J1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgXVxuICAgICAgICB9KTtcblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBERUFMTE9DQVRFIFxuICAgICAgICAgKiBSZXNvdXJjZTogL2RlYWxsb2NhdGVcbiAgICAgICAgICogTWV0aG9kOiBQT1NUXG4gICAgICAgICAqIFJlcXVlc3QgZm9ybWF0OiB7ICdVc2VybmFtZScgOiAnPHRoZSB1c2VyIG5hbWU+J31cbiAgICAgICAgICovXG4gICAgICAgIGxldCBkZWFsbG9jYXRlID0gbmV3IEFQSUdUVy5DZm5SZXNvdXJjZSh0aGlzLCBwcm9wcy5nZXRBcHBSZWZOYW1lKCkgKyBcIkFQSXYxZGVhbGxvY2F0ZVwiLCB7XG4gICAgICAgICAgICBwYXJlbnRJZDogdjEucmVzb3VyY2VJZFxuICAgICAgICAgICAgLCBwYXRoUGFydDogJ2RlYWxsb2NhdGUnXG4gICAgICAgICAgICAsIHJlc3RBcGlJZDogdGhpcy5hcGkucmVzdEFwaUlkXG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIFBPU1RcbiAgICAgICAgbGV0IGRlYWxsb2NhdGVQb3N0TWV0aG9kID0gbmV3IEFQSUdUVy5DZm5NZXRob2QodGhpcywgcHJvcHMuZ2V0QXBwUmVmTmFtZSgpICsgXCJBUEl2MWRlYWxsb2NhdGVQT1NUXCIsIHtcbiAgICAgICAgICAgICAgcmVzdEFwaUlkOiB0aGlzLmFwaS5yZXN0QXBpSWRcbiAgICAgICAgICAgICwgcmVzb3VyY2VJZDogZGVhbGxvY2F0ZS5yZXNvdXJjZUlkXG4gICAgICAgICAgICAsIGF1dGhvcml6YXRpb25UeXBlOiBBUElHVFcuQXV0aG9yaXphdGlvblR5cGUuQ29nbml0b1xuICAgICAgICAgICAgLCBhdXRob3JpemVySWQ6IGF1dGhvcml6ZXIuYXV0aG9yaXplcklkXG4gICAgICAgICAgICAsIGh0dHBNZXRob2Q6ICdQT1NUJ1xuICAgICAgICAgICAgLCBpbnRlZ3JhdGlvbjoge1xuICAgICAgICAgICAgICAgIGludGVncmF0aW9uSHR0cE1ldGhvZDogJ1BPU1QnXG4gICAgICAgICAgICAgICAgLCB0eXBlOiAnQVdTX1BST1hZJ1xuICAgICAgICAgICAgICAgICwgY29udGVudEhhbmRsaW5nOiBcIkNPTlZFUlRfVE9fVEVYVFwiXG4gICAgICAgICAgICAgICAgLCB1cmk6ICdhcm46YXdzOmFwaWdhdGV3YXk6JyArIHByb3BzLnJlZ2lvbiArICc6bGFtYmRhOnBhdGgvMjAxNS0wMy0zMS9mdW5jdGlvbnMvJyArIHByb3BzLmdldFBhcmFtZXRlcignbGFtYmRhLmRlYWxsb2NhdGUnKSArICcvaW52b2NhdGlvbnMnXG4gICAgICAgICAgICAgICAgLCBjcmVkZW50aWFsczogYXBpcm9sZS5yb2xlQXJuXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAsIG1ldGhvZFJlc3BvbnNlczogW1xuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgc3RhdHVzQ29kZTogJzIwMCdcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICBdXG4gICAgICAgIH0pO1xuXG5cbiAgICAgICAgLy8gT1BUSU9OU1xuICAgICAgICBsZXQgZGVhbGxvY2F0ZU9wdGlvbnNNZXRob2QgPSBuZXcgQVBJR1RXLkNmbk1ldGhvZCh0aGlzLCBwcm9wcy5nZXRBcHBSZWZOYW1lKCkgKyBcIkFQSXYxZGVhbGxvY2F0ZU9QVElPTlNcIiwge1xuICAgICAgICAgICAgcmVzdEFwaUlkOiB0aGlzLmFwaS5yZXN0QXBpSWRcbiAgICAgICAgICAgICwgcmVzb3VyY2VJZDogZGVhbGxvY2F0ZS5yZXNvdXJjZUlkXG4gICAgICAgICAgICAsIGF1dGhvcml6YXRpb25UeXBlOiBBUElHVFcuQXV0aG9yaXphdGlvblR5cGUuTm9uZVxuICAgICAgICAgICAgLCBodHRwTWV0aG9kOiAnT1BUSU9OUydcbiAgICAgICAgICAgICwgaW50ZWdyYXRpb246IHtcbiAgICAgICAgICAgICAgICBwYXNzdGhyb3VnaEJlaGF2aW9yOiAnd2hlbl9ub19tYXRjaCdcbiAgICAgICAgICAgICAgICAsIHR5cGU6ICdNT0NLJ1xuICAgICAgICAgICAgICAgICwgcmVxdWVzdFRlbXBsYXRlczoge1xuICAgICAgICAgICAgICAgICAgICAnYXBwbGljYXRpb24vanNvbic6IGB7XFxcInN0YXR1c0NvZGVcXFwiOiAyMDB9YFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAsIGludGVncmF0aW9uUmVzcG9uc2VzOiBbXG4gICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0YXR1c0NvZGU6ICcyMDAnXG4gICAgICAgICAgICAgICAgICAgICAgICAsIHJlc3BvbnNlUGFyYW1ldGVyczoge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICdtZXRob2QucmVzcG9uc2UuaGVhZGVyLkFjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpbic6IFwiJyonXCJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAsICdtZXRob2QucmVzcG9uc2UuaGVhZGVyLkFjY2Vzcy1Db250cm9sLUFsbG93LU1ldGhvZHMnOiBcIicqJ1wiXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLCAnbWV0aG9kLnJlc3BvbnNlLmhlYWRlci5BY2Nlc3MtQ29udHJvbC1BbGxvdy1IZWFkZXJzJzogXCInQ29udGVudC1UeXBlLEF1dGhvcml6YXRpb24sWC1BbXotRGF0ZSxYLUFwaS1LZXksWC1BbXotU2VjdXJpdHktVG9rZW4nXCJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfV1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgICwgbWV0aG9kUmVzcG9uc2VzOiBbXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBzdGF0dXNDb2RlOiAnMjAwJ1xuICAgICAgICAgICAgICAgICAgICAsIHJlc3BvbnNlUGFyYW1ldGVyczoge1xuICAgICAgICAgICAgICAgICAgICAgICAgJ21ldGhvZC5yZXNwb25zZS5oZWFkZXIuQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luJzogdHJ1ZVxuICAgICAgICAgICAgICAgICAgICAgICAgLCAnbWV0aG9kLnJlc3BvbnNlLmhlYWRlci5BY2Nlc3MtQ29udHJvbC1BbGxvdy1NZXRob2RzJzogdHJ1ZVxuICAgICAgICAgICAgICAgICAgICAgICAgLCAnbWV0aG9kLnJlc3BvbnNlLmhlYWRlci5BY2Nlc3MtQ29udHJvbC1BbGxvdy1IZWFkZXJzJzogdHJ1ZVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICwgcmVzcG9uc2VNb2RlbHM6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICdhcHBsaWNhdGlvbi9qc29uJzogJ0VtcHR5J1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgXVxuICAgICAgICB9KTtcblxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFNDT1JFQk9BUkQgXG4gICAgICAgICAqIFJlc291cmNlOiAvZGVhbGxvY2F0ZVxuICAgICAgICAgKiBNZXRob2Q6IEdFVFxuICAgICAgICAgKiBSZXF1ZXN0IGZvcm1hdDogXG4gICAgICAgICAqICAgICAgcXVlcnlzdHJpbmc6IHNlc3Npb25JZD08PFNlc3Npb24gSWQ+PlxuICAgICAgICAgKiBSZXNwb25zZSBmb3JtYXQ6XG4gICAgICAgICAqIHtcbiAgICAgICAgICAgICAgICBcIlNjb3JlYm9hcmRcIjogW1xuICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwiU2NvcmVcIjogNzA1NSxcbiAgICAgICAgICAgICAgICAgICAgXCJMZXZlbFwiOiAxMyxcbiAgICAgICAgICAgICAgICAgICAgXCJTaG90c1wiOiA5NDIsXG4gICAgICAgICAgICAgICAgICAgIFwiTmlja25hbWVcIjogXCJQU0NcIixcbiAgICAgICAgICAgICAgICAgICAgXCJMaXZlc1wiOiAzXG4gICAgICAgICAgICAgICAgICAgIH0uLixcbiAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICB9XG4gICAgICAgICAqL1xuICAgICAgICBsZXQgc2NvcmVib2FyZCA9IG5ldyBBUElHVFcuQ2ZuUmVzb3VyY2UodGhpcywgcHJvcHMuZ2V0QXBwUmVmTmFtZSgpICsgXCJBUEl2MXNjb3JlYm9hcmRcIiwge1xuICAgICAgICAgICAgcGFyZW50SWQ6IHYxLnJlc291cmNlSWRcbiAgICAgICAgICAgICwgcGF0aFBhcnQ6ICdzY29yZWJvYXJkJ1xuICAgICAgICAgICAgLCByZXN0QXBpSWQ6IHRoaXMuYXBpLnJlc3RBcGlJZFxuICAgICAgICB9KTtcblxuICAgICAgICAvLyBQT1NUXG4gICAgICAgIGxldCBzY29yZWJvYXJkUG9zdE1ldGhvZCA9IG5ldyBBUElHVFcuQ2ZuTWV0aG9kKHRoaXMsIHByb3BzLmdldEFwcFJlZk5hbWUoKSArIFwiQVBJdjFzY29yZWJvYXJkUE9TVFwiLCB7XG4gICAgICAgICAgICByZXN0QXBpSWQ6IHRoaXMuYXBpLnJlc3RBcGlJZFxuICAgICAgICAgICAgLCByZXNvdXJjZUlkOiBzY29yZWJvYXJkLnJlc291cmNlSWRcbiAgICAgICAgICAgICwgYXV0aG9yaXphdGlvblR5cGU6IEFQSUdUVy5BdXRob3JpemF0aW9uVHlwZS5Db2duaXRvXG4gICAgICAgICAgICAsIGF1dGhvcml6ZXJJZDogYXV0aG9yaXplci5hdXRob3JpemVySWRcbiAgICAgICAgICAgICwgaHR0cE1ldGhvZDogJ0dFVCdcbiAgICAgICAgICAgICwgcmVxdWVzdFBhcmFtZXRlcnM6IHtcbiAgICAgICAgICAgICAgICAnbWV0aG9kLnJlcXVlc3QucXVlcnlzdHJpbmcuc2Vzc2lvbklkJzogdHJ1ZVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLCBpbnRlZ3JhdGlvbjoge1xuICAgICAgICAgICAgICAgIGludGVncmF0aW9uSHR0cE1ldGhvZDogJ1BPU1QnXG4gICAgICAgICAgICAgICAgLCB0eXBlOiAnQVdTJ1xuICAgICAgICAgICAgICAgICwgdXJpOiAnYXJuOmF3czphcGlnYXRld2F5OicgKyBwcm9wcy5yZWdpb24gKyAnOmR5bmFtb2RiOmFjdGlvbi9HZXRJdGVtJ1xuICAgICAgICAgICAgICAgICwgY3JlZGVudGlhbHM6IGFwaXJvbGUucm9sZUFyblxuICAgICAgICAgICAgICAgICwgcmVxdWVzdFBhcmFtZXRlcnM6IHtcbiAgICAgICAgICAgICAgICAgICAgJ2ludGVncmF0aW9uLnJlcXVlc3QucXVlcnlzdHJpbmcuc2Vzc2lvbklkJzogJ21ldGhvZC5yZXF1ZXN0LnF1ZXJ5c3RyaW5nLnNlc3Npb25JZCdcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLCBwYXNzdGhyb3VnaEJlaGF2aW9yOiAnV0hFTl9OT19URU1QTEFURVMnXG4gICAgICAgICAgICAgICAgLCByZXF1ZXN0VGVtcGxhdGVzOiB7XG4gICAgICAgICAgICAgICAgICAgICdhcHBsaWNhdGlvbi9qc29uJzogYHtcbiAgICAgICAgICAgICAgICAgICAgICAgIFwiVGFibGVOYW1lXCIgOiBcImArICg8VGFibGU+cHJvcHMuZ2V0UGFyYW1ldGVyKCd0YWJsZS5zZXNzaW9udG9weCcpKS50YWJsZU5hbWUgKyBgXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICBcIktleVwiIDoge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiU2Vzc2lvbklkXCIgOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiU1wiIDogXCIkaW5wdXQucGFyYW1zKCdzZXNzaW9uSWQnKVwiXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9YFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAsIGludGVncmF0aW9uUmVzcG9uc2VzOiBbXG4gICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0YXR1c0NvZGU6ICcyMDAnXG4gICAgICAgICAgICAgICAgICAgICAgICAsIHJlc3BvbnNlUGFyYW1ldGVyczoge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICdtZXRob2QucmVzcG9uc2UuaGVhZGVyLkFjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpbic6IFwiJyonXCJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICwgcmVzcG9uc2VUZW1wbGF0ZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBUaGlzIGlzIGdvaW5nIHRvIGJlIHRyaWNreSB0byBiZSBnZW5lcmFsaXplZFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICdhcHBsaWNhdGlvbi9qc29uJzpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYCNzZXQoJHNjb3JlYm9hcmQgPSAkaW5wdXQucGF0aCgnJC5JdGVtLlRvcFguTCcpKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJTY29yZWJvYXJkXCIgOiBbXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAjZm9yZWFjaCgkZ2FtZXJTY29yZSBpbiAkc2NvcmVib2FyZClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJTY29yZVwiIDogJGdhbWVyU2NvcmUuTS5TY29yZS5OICxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiTGV2ZWxcIiA6ICRnYW1lclNjb3JlLk0uTGV2ZWwuTiAsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcIlNob3RzXCIgOiAkZ2FtZXJTY29yZS5NLlNob3RzLk4gLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJOaWNrbmFtZVwiIDogXCIkZ2FtZXJTY29yZS5NLk5pY2tuYW1lLlNcIiAsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcIkxpdmVzXCIgOiAkZ2FtZXJTY29yZS5NLkxpdmVzLk5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSNpZigkZm9yZWFjaC5oYXNOZXh0KSwjZW5kXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICNlbmRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1gXG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1dXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAsIG1ldGhvZFJlc3BvbnNlczogW1xuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgc3RhdHVzQ29kZTogJzIwMCdcbiAgICAgICAgICAgICAgICAgICAgLCByZXNwb25zZVBhcmFtZXRlcnM6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICdtZXRob2QucmVzcG9uc2UuaGVhZGVyLkFjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpbic6IHRydWVcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAsIHJlc3BvbnNlTW9kZWxzOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAnYXBwbGljYXRpb24vanNvbic6IGFwaU1vZGVsU2NvcmVib2FyZFJlc3BvbnNlLnJlZlxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgXVxuICAgICAgICB9KTtcblxuXG4gICAgICAgIC8vIE9QVElPTlNcbiAgICAgICAgbGV0IHNjb3JlYm9hcmRPcHRpb25zTWV0aG9kID0gbmV3IEFQSUdUVy5DZm5NZXRob2QodGhpcywgcHJvcHMuZ2V0QXBwUmVmTmFtZSgpICsgXCJBUEl2MXNjb3JlYm9hcmRPUFRJT05TXCIsIHtcbiAgICAgICAgICAgIHJlc3RBcGlJZDogdGhpcy5hcGkucmVzdEFwaUlkXG4gICAgICAgICAgICAsIHJlc291cmNlSWQ6IHNjb3JlYm9hcmQucmVzb3VyY2VJZFxuICAgICAgICAgICAgLCBhdXRob3JpemF0aW9uVHlwZTogQVBJR1RXLkF1dGhvcml6YXRpb25UeXBlLk5vbmVcbiAgICAgICAgICAgICwgaHR0cE1ldGhvZDogJ09QVElPTlMnXG4gICAgICAgICAgICAsIGludGVncmF0aW9uOiB7XG4gICAgICAgICAgICAgICAgcGFzc3Rocm91Z2hCZWhhdmlvcjogJ3doZW5fbm9fbWF0Y2gnXG4gICAgICAgICAgICAgICAgLCB0eXBlOiAnTU9DSydcbiAgICAgICAgICAgICAgICAsIHJlcXVlc3RUZW1wbGF0ZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgJ2FwcGxpY2F0aW9uL2pzb24nOiBge1xcXCJzdGF0dXNDb2RlXFxcIjogMjAwfWBcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLCBpbnRlZ3JhdGlvblJlc3BvbnNlczogW1xuICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzdGF0dXNDb2RlOiAnMjAwJ1xuICAgICAgICAgICAgICAgICAgICAgICAgLCByZXNwb25zZVBhcmFtZXRlcnM6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAnbWV0aG9kLnJlc3BvbnNlLmhlYWRlci5BY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4nOiBcIicqJ1wiXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLCAnbWV0aG9kLnJlc3BvbnNlLmhlYWRlci5BY2Nlc3MtQ29udHJvbC1BbGxvdy1NZXRob2RzJzogXCInKidcIlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICwgJ21ldGhvZC5yZXNwb25zZS5oZWFkZXIuQWNjZXNzLUNvbnRyb2wtQWxsb3ctSGVhZGVycyc6IFwiJ0NvbnRlbnQtVHlwZSxBdXRob3JpemF0aW9uLFgtQW16LURhdGUsWC1BcGktS2V5LFgtQW16LVNlY3VyaXR5LVRva2VuJ1wiXG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1dXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAsIG1ldGhvZFJlc3BvbnNlczogW1xuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgc3RhdHVzQ29kZTogJzIwMCdcbiAgICAgICAgICAgICAgICAgICAgLCByZXNwb25zZVBhcmFtZXRlcnM6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICdtZXRob2QucmVzcG9uc2UuaGVhZGVyLkFjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpbic6IHRydWVcbiAgICAgICAgICAgICAgICAgICAgICAgICwgJ21ldGhvZC5yZXNwb25zZS5oZWFkZXIuQWNjZXNzLUNvbnRyb2wtQWxsb3ctTWV0aG9kcyc6IHRydWVcbiAgICAgICAgICAgICAgICAgICAgICAgICwgJ21ldGhvZC5yZXNwb25zZS5oZWFkZXIuQWNjZXNzLUNvbnRyb2wtQWxsb3ctSGVhZGVycyc6IHRydWVcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAsIHJlc3BvbnNlTW9kZWxzOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAnYXBwbGljYXRpb24vanNvbic6ICdFbXB0eSdcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIF1cbiAgICAgICAgfSk7XG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogVVBEQVRFU1RBVFVTXG4gICAgICAgICAqIFJlc291cmNlOiAvdXBkYXRlc3RhdHVzXG4gICAgICAgICAqIE1ldGhvZDogUE9TVFxuICAgICAgICAgKiBSZXF1ZXN0IGZvcm1hdDpcbiAgICAgICAgICogIGJvZHkgOiB7XG4gICAgICAgICAqICAgICAgIFwiTGV2ZWxcIjogMSxcbiAgICAgICAgICogICAgICAgXCJMaXZlc1wiOiAzLFxuICAgICAgICAgKiAgICAgICBcIk5pY2tuYW1lXCI6IFwiY2hpY29iZW50b1wiLFxuICAgICAgICAgKiAgICAgICBcIlNjb3JlXCI6IDI1MSxcbiAgICAgICAgICogICAgICAgXCJTZXNzaW9uSWRcIjogXCJYMTgxMDAxVDIxNTgwOFwiLFxuICAgICAgICAgKiAgICAgICBcIlNob3RzXCI6IDQsXG4gICAgICAgICAqICAgICAgIFwiVGltZXN0YW1wXCI6IFwiMjAxOC0xMC0xMFQyMzo1NzoyNi4xMzdaXCJcbiAgICAgICAgICogICAgICAgfVxuICAgICAgICAgKi9cbiAgICAgICAgbGV0IHVwZGF0ZVN0YXR1cyA9IG5ldyBBUElHVFcuQ2ZuUmVzb3VyY2UodGhpcywgcHJvcHMuZ2V0QXBwUmVmTmFtZSgpICsgXCJBUEl2MXVwZGF0ZXN0YXR1c1wiLCB7XG4gICAgICAgICAgICBwYXJlbnRJZDogdjEucmVzb3VyY2VJZFxuICAgICAgICAgICAgLCBwYXRoUGFydDogJ3VwZGF0ZXN0YXR1cydcbiAgICAgICAgICAgICwgcmVzdEFwaUlkOiB0aGlzLmFwaS5yZXN0QXBpSWRcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gUE9TVFxuICAgICAgICBsZXQgdXBkYXRlc3RhdHVzUG9zdE1ldGhvZCA9IG5ldyBBUElHVFcuQ2ZuTWV0aG9kKHRoaXMsIHByb3BzLmdldEFwcFJlZk5hbWUoKSArIFwiQVBJdjF1cGRhdGVzdGF0dXNQT1NUXCIsIHtcbiAgICAgICAgICAgIHJlc3RBcGlJZDogdGhpcy5hcGkucmVzdEFwaUlkXG4gICAgICAgICAgICAsIHJlc291cmNlSWQ6IHVwZGF0ZVN0YXR1cy5yZXNvdXJjZUlkXG4gICAgICAgICAgICAsIGF1dGhvcml6YXRpb25UeXBlOiBBUElHVFcuQXV0aG9yaXphdGlvblR5cGUuQ29nbml0b1xuICAgICAgICAgICAgLCBhdXRob3JpemVySWQ6IGF1dGhvcml6ZXIuYXV0aG9yaXplcklkXG4gICAgICAgICAgICAsIGh0dHBNZXRob2Q6ICdQT1NUJ1xuICAgICAgICAgICAgLCByZXF1ZXN0UGFyYW1ldGVyczoge1xuICAgICAgICAgICAgICAgICdtZXRob2QucmVxdWVzdC5oZWFkZXIuQXV0aGVudGljYXRpb24nOiB0cnVlXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAsIGludGVncmF0aW9uOiB7XG4gICAgICAgICAgICAgICAgaW50ZWdyYXRpb25IdHRwTWV0aG9kOiAnUE9TVCdcbiAgICAgICAgICAgICAgICAsIHR5cGU6ICdBV1MnXG4gICAgICAgICAgICAgICAgLCB1cmk6ICdhcm46YXdzOmFwaWdhdGV3YXk6JyArIHByb3BzLnJlZ2lvbiArICc6a2luZXNpczphY3Rpb24vUHV0UmVjb3JkJ1xuICAgICAgICAgICAgICAgICwgY3JlZGVudGlhbHM6IGFwaXJvbGUucm9sZUFyblxuICAgICAgICAgICAgICAgICwgcGFzc3Rocm91Z2hCZWhhdmlvcjogJ1dIRU5fTk9fVEVNUExBVEVTJ1xuICAgICAgICAgICAgICAgICwgcmVxdWVzdFRlbXBsYXRlczoge1xuICAgICAgICAgICAgICAgICAgICAnYXBwbGljYXRpb24vanNvbic6XG4gICAgICAgICAgICAgICAgICAgICAgICBgI3NldCgkaW5wdXRSb290ID0gJGlucHV0LnBhdGgoJyQnKSlcbiAgICAgICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBcIkRhdGFcIiA6IFwiJHV0aWwuYmFzZTY0RW5jb2RlKFwiJGlucHV0Lmpzb24oJyQnKVwiKVwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiUGFydGl0aW9uS2V5XCIgOiAkaW5wdXQuanNvbignJC5TZXNzaW9uSWQnKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBcIlN0cmVhbU5hbWVcIiA6IFwiYCsgdGhpcy5raW5lc2lzU3RyZWFtcy5zdHJlYW1OYW1lICsgYFwiXG4gICAgICAgICAgICAgICAgICAgICAgICB9YFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAsIGludGVncmF0aW9uUmVzcG9uc2VzOiBbXG4gICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0YXR1c0NvZGU6ICcyMDAnXG4gICAgICAgICAgICAgICAgICAgICAgICAsIHJlc3BvbnNlUGFyYW1ldGVyczoge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICdtZXRob2QucmVzcG9uc2UuaGVhZGVyLkFjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpbic6IFwiJyonXCJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfV1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgICwgbWV0aG9kUmVzcG9uc2VzOiBbXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBzdGF0dXNDb2RlOiAnMjAwJ1xuICAgICAgICAgICAgICAgICAgICAsIHJlc3BvbnNlUGFyYW1ldGVyczoge1xuICAgICAgICAgICAgICAgICAgICAgICAgJ21ldGhvZC5yZXNwb25zZS5oZWFkZXIuQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luJzogdHJ1ZVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgLCByZXNwb25zZU1vZGVsczoge1xuICAgICAgICAgICAgICAgICAgICAnYXBwbGljYXRpb24vanNvbic6ICdFbXB0eSdcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgXVxuICAgICAgICB9KTtcblxuXG4gICAgICAgIC8vIE9QVElPTlNcbiAgICAgICAgbGV0IHVwZGF0ZXN0YXR1c09wdGlvbnNNZXRob2QgPSBuZXcgQVBJR1RXLkNmbk1ldGhvZCh0aGlzLCBwcm9wcy5nZXRBcHBSZWZOYW1lKCkgKyBcIkFQSXYxdXBkYXRlU3RhdHVzT1BUSU9OU1wiLCB7XG4gICAgICAgICAgICByZXN0QXBpSWQ6IHRoaXMuYXBpLnJlc3RBcGlJZFxuICAgICAgICAgICAgLCByZXNvdXJjZUlkOiB1cGRhdGVTdGF0dXMucmVzb3VyY2VJZFxuICAgICAgICAgICAgLCBhdXRob3JpemF0aW9uVHlwZTogQVBJR1RXLkF1dGhvcml6YXRpb25UeXBlLk5vbmVcbiAgICAgICAgICAgICwgaHR0cE1ldGhvZDogJ09QVElPTlMnXG4gICAgICAgICAgICAsIGludGVncmF0aW9uOiB7XG4gICAgICAgICAgICAgICAgcGFzc3Rocm91Z2hCZWhhdmlvcjogJ3doZW5fbm9fbWF0Y2gnXG4gICAgICAgICAgICAgICAgLCB0eXBlOiAnTU9DSydcbiAgICAgICAgICAgICAgICAsIHJlcXVlc3RUZW1wbGF0ZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgJ2FwcGxpY2F0aW9uL2pzb24nOiBge1xcXCJzdGF0dXNDb2RlXFxcIjogMjAwfWBcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLCBpbnRlZ3JhdGlvblJlc3BvbnNlczogW1xuICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzdGF0dXNDb2RlOiAnMjAwJ1xuICAgICAgICAgICAgICAgICAgICAgICAgLCByZXNwb25zZVBhcmFtZXRlcnM6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAnbWV0aG9kLnJlc3BvbnNlLmhlYWRlci5BY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4nOiBcIicqJ1wiXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLCAnbWV0aG9kLnJlc3BvbnNlLmhlYWRlci5BY2Nlc3MtQ29udHJvbC1BbGxvdy1NZXRob2RzJzogXCInKidcIlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICwgJ21ldGhvZC5yZXNwb25zZS5oZWFkZXIuQWNjZXNzLUNvbnRyb2wtQWxsb3ctSGVhZGVycyc6IFwiJ0NvbnRlbnQtVHlwZSxBdXRob3JpemF0aW9uLFgtQW16LURhdGUsWC1BcGktS2V5LFgtQW16LVNlY3VyaXR5LVRva2VuJ1wiXG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1dXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAsIG1ldGhvZFJlc3BvbnNlczogW1xuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgc3RhdHVzQ29kZTogJzIwMCdcbiAgICAgICAgICAgICAgICAgICAgLCByZXNwb25zZVBhcmFtZXRlcnM6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICdtZXRob2QucmVzcG9uc2UuaGVhZGVyLkFjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpbic6IHRydWVcbiAgICAgICAgICAgICAgICAgICAgICAgICwgJ21ldGhvZC5yZXNwb25zZS5oZWFkZXIuQWNjZXNzLUNvbnRyb2wtQWxsb3ctTWV0aG9kcyc6IHRydWVcbiAgICAgICAgICAgICAgICAgICAgICAgICwgJ21ldGhvZC5yZXNwb25zZS5oZWFkZXIuQWNjZXNzLUNvbnRyb2wtQWxsb3ctSGVhZGVycyc6IHRydWVcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICwgcmVzcG9uc2VNb2RlbHM6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICdhcHBsaWNhdGlvbi9qc29uJzogJ0VtcHR5J1xuICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICBdXG4gICAgICAgIH0pO1xuXG5cbiAgICAgICAgbGV0IGRlcGxveW1lbnQgPSBuZXcgQVBJR1RXLkNmbkRlcGxveW1lbnQodGhpcywgcHJvcHMuZ2V0QXBwUmVmTmFtZSgpICsgXCJBUElEZXBsb3ltZW50XCIsIHtcbiAgICAgICAgICAgIHJlc3RBcGlJZDogdGhpcy5hcGkucmVzdEFwaUlkXG4gICAgICAgICAgICAsIHN0YWdlTmFtZTogJ3Byb2QnXG4gICAgICAgICAgICAsIGRlc2NyaXB0aW9uOiAnUHJvZHVjdGlvbiBkZXBsb3ltZW50J1xuICAgICAgICB9KTtcbiAgICAgICAgZGVwbG95bWVudC5hZGREZXBlbmRzT24oc2Vzc2lvbkdldE1ldGhvZCk7XG4gICAgICAgIGRlcGxveW1lbnQuYWRkRGVwZW5kc09uKHNlc3Npb25PcHRpb25zTWV0aG9kKTtcbiAgICAgICAgZGVwbG95bWVudC5hZGREZXBlbmRzT24oY29uZmlnR2V0TWV0aG9kKTtcbiAgICAgICAgZGVwbG95bWVudC5hZGREZXBlbmRzT24oY29uZmlnT3B0aW9uc01ldGhvZCk7XG4gICAgICAgIGRlcGxveW1lbnQuYWRkRGVwZW5kc09uKGFsbG9jYXRlUG9zdE1ldGhvZCk7XG4gICAgICAgIGRlcGxveW1lbnQuYWRkRGVwZW5kc09uKGFsbG9jYXRlT3B0aW9uc01ldGhvZCk7XG4gICAgICAgIGRlcGxveW1lbnQuYWRkRGVwZW5kc09uKGRlYWxsb2NhdGVQb3N0TWV0aG9kKTtcbiAgICAgICAgZGVwbG95bWVudC5hZGREZXBlbmRzT24oZGVhbGxvY2F0ZU9wdGlvbnNNZXRob2QpO1xuICAgICAgICBkZXBsb3ltZW50LmFkZERlcGVuZHNPbihzY29yZWJvYXJkUG9zdE1ldGhvZCk7XG4gICAgICAgIGRlcGxveW1lbnQuYWRkRGVwZW5kc09uKHNjb3JlYm9hcmRPcHRpb25zTWV0aG9kKTtcbiAgICAgICAgZGVwbG95bWVudC5hZGREZXBlbmRzT24odXBkYXRlc3RhdHVzUG9zdE1ldGhvZCk7XG4gICAgICAgIGRlcGxveW1lbnQuYWRkRGVwZW5kc09uKHVwZGF0ZXN0YXR1c09wdGlvbnNNZXRob2QpO1xuICAgIH1cblxuXG4gICAgdXBkYXRlVXNlcnNSb2xlcyhwcm9wczogSVBhcmFtZXRlckF3YXJlUHJvcHMpIHtcblxuICAgICAgICBsZXQgYmFzZUFybiA9ICdhcm46YXdzOmFwaWdhdGV3YXk6JyArIHByb3BzLnJlZ2lvbiArICc6Jytwcm9wcy5hY2NvdW50SWQrJzonICsgdGhpcy5hcGkucmVzdEFwaUlkICsgJy9wcm9kLyovJztcbiAgICAgICAgbGV0IGJhc2VFeGVjQXJuID0gJ2Fybjphd3M6ZXhlY3V0ZS1hcGk6JyArIHByb3BzLnJlZ2lvbiArICc6Jytwcm9wcy5hY2NvdW50SWQrJzonICsgdGhpcy5hcGkucmVzdEFwaUlkICsgJy9wcm9kLyc7XG4gICAgICAgIGxldCBwbGF5ZXJSb2xlID0gKDxJQU0uUm9sZT5wcm9wcy5nZXRQYXJhbWV0ZXIoJ3NlY3VyaXR5LnBsYXllcnNyb2xlJykpO1xuXG4gICAgICAgIC8qXG4gICAgICAgIHBsYXllclJvbGUuYWRkVG9Qb2xpY3koXG4gICAgICAgICAgICBuZXcgSUFNLlBvbGljeVN0YXRlbWVudCgpXG4gICAgICAgICAgICAgICAgLmRlc2NyaWJlKCdBUElHYXRld2F5UGVybWlzc2lvbnMnKVxuICAgICAgICAgICAgICAgIC5hbGxvdygpXG4gICAgICAgICAgICAgICAgLmFkZEFjdGlvbignZXhlY3V0ZS1hcGk6SW52b2tlJylcbiAgICAgICAgICAgICAgICAuYWRkUmVzb3VyY2VzKFxuICAgICAgICAgICAgICAgICAgICBiYXNlQXJuXG4gICAgICAgICAgICAgICAgKVxuICAgICAgICApO1xuICAgICAgICAqL1xuXG4gICAgICAgIHBsYXllclJvbGUuYWRkVG9Qb2xpY3koXG4gICAgICAgICAgICBuZXcgSUFNLlBvbGljeVN0YXRlbWVudCgpXG4gICAgICAgICAgICAgICAgLmRlc2NyaWJlKCdBUElHYXRld2F5R0VUUGVybWlzc2lvbnMnKVxuICAgICAgICAgICAgICAgIC5hbGxvdygpXG4gICAgICAgICAgICAgICAgLmFkZEFjdGlvbignYXBpZ2F0ZXdheTpHRVQnKVxuICAgICAgICAgICAgICAgIC5hZGRSZXNvdXJjZXMoXG4gICAgICAgICAgICAgICAgICAgIGJhc2VBcm4gKyAnY29uZmlnJyxcbiAgICAgICAgICAgICAgICAgICAgYmFzZUFybiArICdzZXNzaW9uJyxcbiAgICAgICAgICAgICAgICAgICAgYmFzZUFybiArICdzY29yZWJvYXJkJ1xuICAgICAgICAgICAgICAgIClcbiAgICAgICAgKTtcbiAgICAgICAgcGxheWVyUm9sZS5hZGRUb1BvbGljeShcbiAgICAgICAgICAgIG5ldyBJQU0uUG9saWN5U3RhdGVtZW50KClcbiAgICAgICAgICAgICAgICAuZGVzY3JpYmUoJ0FQSUdhdGV3YXlFWEVDR0VUUGVybWlzc2lvbnMnKVxuICAgICAgICAgICAgICAgIC5hbGxvdygpXG4gICAgICAgICAgICAgICAgLmFkZEFjdGlvbignZXhlY3V0ZS1hcGk6SW52b2tlJylcbiAgICAgICAgICAgICAgICAuYWRkUmVzb3VyY2VzKFxuICAgICAgICAgICAgICAgICAgICBiYXNlRXhlY0FybiArICdHRVQvY29uZmlnJyxcbiAgICAgICAgICAgICAgICAgICAgYmFzZUV4ZWNBcm4gKyAnR0VUL3Nlc3Npb24nLFxuICAgICAgICAgICAgICAgICAgICBiYXNlRXhlY0FybiArICdHRVQvc2NvcmVib2FyZCdcbiAgICAgICAgICAgICAgICApXG4gICAgICAgICk7XG4gICAgICAgIHBsYXllclJvbGUuYWRkVG9Qb2xpY3koXG4gICAgICAgICAgICBuZXcgSUFNLlBvbGljeVN0YXRlbWVudCgpXG4gICAgICAgICAgICAgICAgLmRlc2NyaWJlKCdBUElHYXRld2F5UE9TVFBlcm1pc3Npb25zJylcbiAgICAgICAgICAgICAgICAuYWxsb3coKVxuICAgICAgICAgICAgICAgIC5hZGRBY3Rpb24oJ2FwaWdhdGV3YXk6UE9TVCcpXG4gICAgICAgICAgICAgICAgLmFkZFJlc291cmNlcyhcbiAgICAgICAgICAgICAgICAgICAgYmFzZUFybiArICd1cGRhdGVzdGF0dXMnLFxuICAgICAgICAgICAgICAgICAgICBiYXNlQXJuICsgJ2FsbG9jYXRlJyxcbiAgICAgICAgICAgICAgICAgICAgYmFzZUFybiArICdkZWFsbG9jYXRlJ1xuICAgICAgICAgICAgICAgIClcbiAgICAgICAgKTtcbiAgICAgICAgcGxheWVyUm9sZS5hZGRUb1BvbGljeShcbiAgICAgICAgICAgIG5ldyBJQU0uUG9saWN5U3RhdGVtZW50KClcbiAgICAgICAgICAgICAgICAuZGVzY3JpYmUoJ0FQSUdhdGV3YXlFWEVDUE9TVFBlcm1pc3Npb25zJylcbiAgICAgICAgICAgICAgICAuYWxsb3coKVxuICAgICAgICAgICAgICAgIC5hZGRBY3Rpb24oJ2V4ZWN1dGUtYXBpOkludm9rZScpXG4gICAgICAgICAgICAgICAgLmFkZFJlc291cmNlcyhcbiAgICAgICAgICAgICAgICAgICAgYmFzZUV4ZWNBcm4gKyAnUE9TVC91cGRhdGVzdGF0dXMnLFxuICAgICAgICAgICAgICAgICAgICBiYXNlRXhlY0FybiArICdQT1NUL2FsbG9jYXRlJyxcbiAgICAgICAgICAgICAgICAgICAgYmFzZUV4ZWNBcm4gKyAnUE9TVC9kZWFsbG9jYXRlJ1xuICAgICAgICAgICAgICAgIClcbiAgICAgICAgKTtcblxuICAgICAgICBsZXQgbWFuYWdlclJvbGUgPSAoPElBTS5Sb2xlPiBwcm9wcy5nZXRQYXJhbWV0ZXIoJ3NlY3VyaXR5Lm1hbmFnZXJzcm9sZScpKTtcbiAgICAgICAgbWFuYWdlclJvbGUuYWRkVG9Qb2xpY3koXG4gICAgICAgICAgICBuZXcgSUFNLlBvbGljeVN0YXRlbWVudCgpXG4gICAgICAgICAgICAgICAgLmRlc2NyaWJlKCdEeW5hbW9EQlBlcm1pc3Npb25zJylcbiAgICAgICAgICAgICAgICAuYWxsb3coKVxuICAgICAgICAgICAgICAgIC5hZGRBY3Rpb25zKFxuICAgICAgICAgICAgICAgICAgICBcImR5bmFtb2RiOkJhdGNoR2V0SXRlbVwiLFxuICAgICAgICAgICAgICAgICAgICBcImR5bmFtb2RiOkJhdGNoV3JpdGVJdGVtXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiZHluYW1vZGI6UHV0SXRlbVwiLFxuICAgICAgICAgICAgICAgICAgICBcImR5bmFtb2RiOlNjYW5cIixcbiAgICAgICAgICAgICAgICAgICAgXCJkeW5hbW9kYjpRdWVyeVwiLFxuICAgICAgICAgICAgICAgICAgICBcImR5bmFtb2RiOkdldEl0ZW1cIiAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgICAuYWRkUmVzb3VyY2UoXG4gICAgICAgICAgICAgICAgICAgIFwiYXJuOmF3czpkeW5hbW9kYjpcIitwcm9wcy5yZWdpb24rXCI6XCIrcHJvcHMuYWNjb3VudElkK1wiOnRhYmxlL1wiK3Byb3BzLmdldEFwcFJlZk5hbWUoKStcIipcIlxuICAgICAgICAgICAgICAgIClcbiAgICAgICAgKTtcbiAgICAgICAgbWFuYWdlclJvbGUuYWRkVG9Qb2xpY3koXG4gICAgICAgICAgICBuZXcgSUFNLlBvbGljeVN0YXRlbWVudCgpXG4gICAgICAgICAgICAgICAgLmRlc2NyaWJlKCdTeXN0ZW1zTWFuYWdlclBlcm1pc3Npb25zJylcbiAgICAgICAgICAgICAgICAuYWRkQWN0aW9ucyhcbiAgICAgICAgICAgICAgICAgICAgXCJzc206R2V0UGFyYW1ldGVyc1wiLFxuICAgICAgICAgICAgICAgICAgICBcInNzbTpHZXRQYXJhbWV0ZXJcIixcbiAgICAgICAgICAgICAgICAgICAgXCJzc206RGVsZXRlUGFyYW1ldGVyc1wiLFxuICAgICAgICAgICAgICAgICAgICBcInNzbTpQdXRQYXJhbWV0ZXJcIixcbiAgICAgICAgICAgICAgICAgICAgXCJzc206RGVsZXRlUGFyYW1ldGVyXCJcbiAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgLmFkZFJlc291cmNlKFxuICAgICAgICAgICAgICAgICAgICBcImFybjphd3M6c3NtOlwiK3Byb3BzLnJlZ2lvbitcIjpcIitwcm9wcy5hY2NvdW50SWQrXCI6cGFyYW1ldGVyL1wiK3Byb3BzLmdldEFwcFJlZk5hbWUoKS50b0xvd2VyQ2FzZSgpK1wiLypcIlxuICAgICAgICAgICAgICAgIClcbiAgICAgICAgKTtcbiAgICAgICAgbWFuYWdlclJvbGUuYWRkVG9Qb2xpY3koXG4gICAgICAgICAgICBuZXcgSUFNLlBvbGljeVN0YXRlbWVudCgpXG4gICAgICAgICAgICAuZGVzY3JpYmUoJ0tpbmVzaXNQZXJtaXNzaW9ucycpXG4gICAgICAgICAgICAuYWRkQWN0aW9ucyhcbiAgICAgICAgICAgICAgICBcImtpbmVzaXM6R2V0U2hhcmRJdGVyYXRvclwiLFxuICAgICAgICAgICAgICAgIFwia2luZXNpczpEZXNjcmliZVN0cmVhbVwiLFxuICAgICAgICAgICAgICAgIFwia2luZXNpczpHZXRSZWNvcmRzXCJcbiAgICAgICAgICAgIClcbiAgICAgICAgICAgIC5hZGRSZXNvdXJjZShcbiAgICAgICAgICAgICAgICB0aGlzLmtpbmVzaXNTdHJlYW1zLnN0cmVhbUFyblxuICAgICAgICAgICAgKVxuICAgICAgICApO1xuICAgICAgICAvKlxuICAgICAgICBtYW5hZ2VyUm9sZS5hZGRUb1BvbGljeShcbiAgICAgICAgICAgIG5ldyBJQU0uUG9saWN5U3RhdGVtZW50KClcbiAgICAgICAgICAgICAgICAuZGVzY3JpYmUoJ0FQSUdhdGV3YXlQZXJtaXNzaW9ucycpXG4gICAgICAgICAgICAgICAgLmFsbG93KClcbiAgICAgICAgICAgICAgICAuYWRkQWN0aW9uKCdleGVjdXRlLWFwaTpJbnZva2UnKVxuICAgICAgICAgICAgICAgIC5hZGRSZXNvdXJjZXMoXG4gICAgICAgICAgICAgICAgICAgIGJhc2VBcm5cbiAgICAgICAgICAgICAgICApXG4gICAgICAgICk7XG4gICAgICAgICAgICAgICAgKi9cbiAgICAgICAgbWFuYWdlclJvbGUuYWRkVG9Qb2xpY3koXG4gICAgICAgICAgICBuZXcgSUFNLlBvbGljeVN0YXRlbWVudCgpXG4gICAgICAgICAgICAgICAgLmRlc2NyaWJlKCdBUElHYXRld2F5UGVybWlzc2lvbnMnKVxuICAgICAgICAgICAgICAgIC5hbGxvdygpXG4gICAgICAgICAgICAgICAgLmFkZEFjdGlvbignYXBpZ2F0ZXdheToqJylcbiAgICAgICAgICAgICAgICAuYWRkUmVzb3VyY2VzKFxuICAgICAgICAgICAgICAgICAgICBiYXNlQXJuICsgJyonIFxuICAgICAgICAgICAgICAgIClcbiAgICAgICAgKTtcbiAgICB9XG5cbn0iXX0=