"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const resourceawarestack_1 = require("./../resourceawarestack");
const KDS = require("@aws-cdk/aws-kinesis");
const IAM = require("@aws-cdk/aws-iam");
const APIGTW = require("@aws-cdk/aws-apigateway");
const aws_iam_1 = require("@aws-cdk/aws-iam");
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
        /**
         * MISSING KINESIS INTEGRATION
         * Uncomment the following lines to solve it
         */
        /*
        (<Lambda.Function> props.getParameter('lambda.scoreboard')).addEventSource(
               new KinesisEventSource(this.kinesisStreams, {
                batchSize : 700,
                startingPosition : Lambda.StartingPosition.Latest
               })
        );
        */
        /**
         * MISSING KINESIS FIREHOSE
         * Uncomment the following section to solve it
         */
        /*
                let firehoseLogGroup = '/aws/kinesisfirehose/' + ((props.getAppRefName() + 'firehose').toLowerCase());
                let self = this;
                let firehoseRole = new IAM.Role(this, props.getAppRefName() + 'FirehoseToStreamsRole', {
                    roleName: props.getAppRefName() + 'FirehoseToStreamsRole',
                    assumedBy: new IAM.ServicePrincipal('firehose.amazonaws.com'),
                    inlinePolicies: {
                        'S3RawDataPermission': new PolicyDocument()
                            .addStatement(new IAM.PolicyStatement()
                                .allow()
                                .addAction('s3:AbortMultipartUpload')
                                .addAction('s3:GetBucketLocation')
                                .addAction('s3:GetObject')
                                .addAction('s3:ListBucket')
                                .addAction('s3:ListBucketMultipartUploads')
                                .addAction('s3:PutObject')
                                .addResource(self.rawbucketarn)
                                .addResource(self.rawbucketarn + '/*')
                            )
                        ,
                        'InputStreamReadPermissions': new PolicyDocument()
                            .addStatement(new IAM.PolicyStatement()
                                .allow()
                                .addAction('kinesis:DescribeStream')
                                .addAction('kinesis:GetShardIterator')
                                .addAction('kinesis:GetRecords')
                                .addResource(this.kinesisStreams.streamArn)
                            )
                        ,
                        'GluePermissions': new PolicyDocument()
                            .addStatement(new IAM.PolicyStatement()
                                .allow()
                                .addAllResources()
                                .addAction('glue:GetTableVersions')
                            )
                        ,
                        'CloudWatchLogsPermissions': new PolicyDocument()
                            .addStatement(new IAM.PolicyStatement()
                                .allow()
                                .addAction('logs:PutLogEvents')
                                .addResource('arn:aws:logs:' + props.region + ':' + props.accountId + ':log-group:' + firehoseLogGroup + ':*:*')
                                .addResource('arn:aws:logs:' + props.region + ':' + props.accountId + ':log-group:' + firehoseLogGroup)
                            )
                    }
                });
        
                this.kinesisFirehose = new KDF.CfnDeliveryStream(this, props.getAppRefName() + 'RawData', {
                    deliveryStreamType: 'KinesisStreamAsSource',
                    deliveryStreamName: props.getAppRefName() + 'Firehose',
                    kinesisStreamSourceConfiguration: {
                        kinesisStreamArn: this.kinesisStreams.streamArn,
                        roleArn: firehoseRole.roleArn
                    }
                    , s3DestinationConfiguration: {
                        bucketArn: <string>this.rawbucketarn,
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
                })
                */
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
        managerRole.addToPolicy(new IAM.PolicyStatement()
            .describe('APIGatewayPermissions')
            .allow()
            .addAction('apigateway:*')
            .addResources(baseArn + '*'));
    }
}
exports.IngestionConsumptionLayer = IngestionConsumptionLayer;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5nZXN0aW9uQ29uc3VtcHRpb25MYXllci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImluZ2VzdGlvbkNvbnN1bXB0aW9uTGF5ZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFDQSxnRUFBc0Y7QUFHdEYsNENBQTZDO0FBRTdDLHdDQUF5QztBQUN6QyxrREFBbUQ7QUFDbkQsOENBQWtEO0FBS2xELE1BQWEseUJBQTBCLFNBQVEsMkNBQXNCO0lBUWpFLFlBQVksTUFBaUIsRUFBRSxJQUFZLEVBQUUsS0FBMkI7UUFDcEUsS0FBSyxDQUFDLE1BQU0sRUFBRSxJQUFJLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDM0IsSUFBSSxDQUFDLFlBQVksR0FBRyxLQUFLLENBQUMsWUFBWSxDQUFDLGNBQWMsQ0FBQyxDQUFDO1FBQ3ZELElBQUksQ0FBQyxRQUFRLEdBQUcsS0FBSyxDQUFDLFlBQVksQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUMvQyxJQUFJLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQzFCLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUM3QixJQUFJLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDakMsQ0FBQztJQUVELGFBQWEsQ0FBQyxLQUEyQjtRQUVyQyxJQUFJLENBQUMsY0FBYyxHQUFHLElBQUksR0FBRyxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLGFBQWEsRUFBRSxHQUFHLGFBQWEsRUFBRTtZQUM5RSxVQUFVLEVBQUUsS0FBSyxDQUFDLGFBQWEsRUFBRSxHQUFHLGNBQWM7WUFDbEQsVUFBVSxFQUFFLENBQUM7U0FDaEIsQ0FBQyxDQUFDO1FBRUg7OztXQUdHO1FBQ0g7Ozs7Ozs7VUFPRTtRQUVGOzs7V0FHRztRQUNYOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztrQkFvRVU7SUFF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LEtBQUssQ0FBQyxNQUFNLEdBQUMsR0FBRyxHQUFDLEtBQUssQ0FBQyxTQUFTLEdBQUMsYUFBYSxHQUFDLEtBQUssQ0FBQyxhQUFhLEVBQUUsQ0FBQyxXQUFXLEVBQUUsR0FBQyxJQUFJLENBQ3pHLENBQ1IsQ0FBQztRQUNGLFdBQVcsQ0FBQyxXQUFXLENBQ25CLElBQUksR0FBRyxDQUFDLGVBQWUsRUFBRTthQUN4QixRQUFRLENBQUMsb0JBQW9CLENBQUM7YUFDOUIsVUFBVSxDQUNQLDBCQUEwQixFQUMxQix3QkFBd0IsRUFDeEIsb0JBQW9CLENBQ3ZCO2FBQ0EsV0FBVyxDQUNSLElBQUksQ0FBQyxjQUFjLENBQUMsU0FBUyxDQUNoQyxDQUNKLENBQUM7UUFFRixXQUFXLENBQUMsV0FBVyxDQUNuQixJQUFJLEdBQUcsQ0FBQyxlQUFlLEVBQUU7YUFDcEIsUUFBUSxDQUFDLHVCQUF1QixDQUFDO2FBQ2pDLEtBQUssRUFBRTthQUNQLFNBQVMsQ0FBQyxjQUFjLENBQUM7YUFDekIsWUFBWSxDQUNULE9BQU8sR0FBRyxHQUFHLENBQ2hCLENBQ1IsQ0FBQztJQUNOLENBQUM7Q0FFSjtBQTMrQkQsOERBMitCQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ0Bhd3MtY2RrL2Nkayc7XG5pbXBvcnQgeyBSZXNvdXJjZUF3YXJlQ29uc3RydWN0LCBJUGFyYW1ldGVyQXdhcmVQcm9wcyB9IGZyb20gJy4vLi4vcmVzb3VyY2Vhd2FyZXN0YWNrJ1xuXG5cbmltcG9ydCBLRFMgPSByZXF1aXJlKCdAYXdzLWNkay9hd3Mta2luZXNpcycpO1xuaW1wb3J0IEtERiA9IHJlcXVpcmUoJ0Bhd3MtY2RrL2F3cy1raW5lc2lzZmlyZWhvc2UnKTtcbmltcG9ydCBJQU0gPSByZXF1aXJlKCdAYXdzLWNkay9hd3MtaWFtJyk7XG5pbXBvcnQgQVBJR1RXID0gcmVxdWlyZSgnQGF3cy1jZGsvYXdzLWFwaWdhdGV3YXknKTtcbmltcG9ydCB7IFBvbGljeURvY3VtZW50IH0gZnJvbSAnQGF3cy1jZGsvYXdzLWlhbSc7XG5pbXBvcnQgeyBUYWJsZSB9IGZyb20gJ0Bhd3MtY2RrL2F3cy1keW5hbW9kYic7XG5pbXBvcnQgTGFtYmRhID0gcmVxdWlyZSgnQGF3cy1jZGsvYXdzLWxhbWJkYScpO1xuaW1wb3J0IHsgS2luZXNpc0V2ZW50U291cmNlLCBBcGlFdmVudFNvdXJjZSB9IGZyb20gJ0Bhd3MtY2RrL2F3cy1sYW1iZGEtZXZlbnQtc291cmNlcyc7XG5cbmV4cG9ydCBjbGFzcyBJbmdlc3Rpb25Db25zdW1wdGlvbkxheWVyIGV4dGVuZHMgUmVzb3VyY2VBd2FyZUNvbnN0cnVjdCB7XG5cbiAgICBraW5lc2lzU3RyZWFtczogS0RTLlN0cmVhbTtcbiAgICBraW5lc2lzRmlyZWhvc2U6IEtERi5DZm5EZWxpdmVyeVN0cmVhbTtcbiAgICBwcml2YXRlIHJhd2J1Y2tldGFybjogc3RyaW5nO1xuICAgIHByaXZhdGUgdXNlcnBvb2w6IHN0cmluZztcbiAgICBwcml2YXRlIGFwaTogQVBJR1RXLkNmblJlc3RBcGk7XG5cbiAgICBjb25zdHJ1Y3RvcihwYXJlbnQ6IENvbnN0cnVjdCwgbmFtZTogc3RyaW5nLCBwcm9wczogSVBhcmFtZXRlckF3YXJlUHJvcHMpIHtcbiAgICAgICAgc3VwZXIocGFyZW50LCBuYW1lLCBwcm9wcyk7XG4gICAgICAgIHRoaXMucmF3YnVja2V0YXJuID0gcHJvcHMuZ2V0UGFyYW1ldGVyKCdyYXdidWNrZXRhcm4nKTtcbiAgICAgICAgdGhpcy51c2VycG9vbCA9IHByb3BzLmdldFBhcmFtZXRlcigndXNlcnBvb2wnKTtcbiAgICAgICAgdGhpcy5jcmVhdGVLaW5lc2lzKHByb3BzKTtcbiAgICAgICAgdGhpcy5jcmVhdGVBUElHYXRld2F5KHByb3BzKTtcbiAgICAgICAgdGhpcy51cGRhdGVVc2Vyc1JvbGVzKHByb3BzKTtcbiAgICB9XG5cbiAgICBjcmVhdGVLaW5lc2lzKHByb3BzOiBJUGFyYW1ldGVyQXdhcmVQcm9wcykge1xuXG4gICAgICAgIHRoaXMua2luZXNpc1N0cmVhbXMgPSBuZXcgS0RTLlN0cmVhbSh0aGlzLCBwcm9wcy5nZXRBcHBSZWZOYW1lKCkgKyAnSW5wdXRTdHJlYW0nLCB7XG4gICAgICAgICAgICBzdHJlYW1OYW1lOiBwcm9wcy5nZXRBcHBSZWZOYW1lKCkgKyAnX0lucHV0U3RyZWFtJyxcbiAgICAgICAgICAgIHNoYXJkQ291bnQ6IDFcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIE1JU1NJTkcgS0lORVNJUyBJTlRFR1JBVElPTlxuICAgICAgICAgKiBVbmNvbW1lbnQgdGhlIGZvbGxvd2luZyBsaW5lcyB0byBzb2x2ZSBpdFxuICAgICAgICAgKi9cbiAgICAgICAgLypcbiAgICAgICAgKDxMYW1iZGEuRnVuY3Rpb24+IHByb3BzLmdldFBhcmFtZXRlcignbGFtYmRhLnNjb3JlYm9hcmQnKSkuYWRkRXZlbnRTb3VyY2UoXG4gICAgICAgICAgICAgICBuZXcgS2luZXNpc0V2ZW50U291cmNlKHRoaXMua2luZXNpc1N0cmVhbXMsIHtcbiAgICAgICAgICAgICAgICBiYXRjaFNpemUgOiA3MDAsXG4gICAgICAgICAgICAgICAgc3RhcnRpbmdQb3NpdGlvbiA6IExhbWJkYS5TdGFydGluZ1Bvc2l0aW9uLkxhdGVzdFxuICAgICAgICAgICAgICAgfSlcbiAgICAgICAgKTtcbiAgICAgICAgKi9cblxuICAgICAgICAvKipcbiAgICAgICAgICogTUlTU0lORyBLSU5FU0lTIEZJUkVIT1NFXG4gICAgICAgICAqIFVuY29tbWVudCB0aGUgZm9sbG93aW5nIHNlY3Rpb24gdG8gc29sdmUgaXRcbiAgICAgICAgICovXG4vKlxuICAgICAgICBsZXQgZmlyZWhvc2VMb2dHcm91cCA9ICcvYXdzL2tpbmVzaXNmaXJlaG9zZS8nICsgKChwcm9wcy5nZXRBcHBSZWZOYW1lKCkgKyAnZmlyZWhvc2UnKS50b0xvd2VyQ2FzZSgpKTtcbiAgICAgICAgbGV0IHNlbGYgPSB0aGlzO1xuICAgICAgICBsZXQgZmlyZWhvc2VSb2xlID0gbmV3IElBTS5Sb2xlKHRoaXMsIHByb3BzLmdldEFwcFJlZk5hbWUoKSArICdGaXJlaG9zZVRvU3RyZWFtc1JvbGUnLCB7XG4gICAgICAgICAgICByb2xlTmFtZTogcHJvcHMuZ2V0QXBwUmVmTmFtZSgpICsgJ0ZpcmVob3NlVG9TdHJlYW1zUm9sZScsXG4gICAgICAgICAgICBhc3N1bWVkQnk6IG5ldyBJQU0uU2VydmljZVByaW5jaXBhbCgnZmlyZWhvc2UuYW1hem9uYXdzLmNvbScpLFxuICAgICAgICAgICAgaW5saW5lUG9saWNpZXM6IHtcbiAgICAgICAgICAgICAgICAnUzNSYXdEYXRhUGVybWlzc2lvbic6IG5ldyBQb2xpY3lEb2N1bWVudCgpXG4gICAgICAgICAgICAgICAgICAgIC5hZGRTdGF0ZW1lbnQobmV3IElBTS5Qb2xpY3lTdGF0ZW1lbnQoKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmFsbG93KClcbiAgICAgICAgICAgICAgICAgICAgICAgIC5hZGRBY3Rpb24oJ3MzOkFib3J0TXVsdGlwYXJ0VXBsb2FkJylcbiAgICAgICAgICAgICAgICAgICAgICAgIC5hZGRBY3Rpb24oJ3MzOkdldEJ1Y2tldExvY2F0aW9uJylcbiAgICAgICAgICAgICAgICAgICAgICAgIC5hZGRBY3Rpb24oJ3MzOkdldE9iamVjdCcpXG4gICAgICAgICAgICAgICAgICAgICAgICAuYWRkQWN0aW9uKCdzMzpMaXN0QnVja2V0JylcbiAgICAgICAgICAgICAgICAgICAgICAgIC5hZGRBY3Rpb24oJ3MzOkxpc3RCdWNrZXRNdWx0aXBhcnRVcGxvYWRzJylcbiAgICAgICAgICAgICAgICAgICAgICAgIC5hZGRBY3Rpb24oJ3MzOlB1dE9iamVjdCcpXG4gICAgICAgICAgICAgICAgICAgICAgICAuYWRkUmVzb3VyY2Uoc2VsZi5yYXdidWNrZXRhcm4pXG4gICAgICAgICAgICAgICAgICAgICAgICAuYWRkUmVzb3VyY2Uoc2VsZi5yYXdidWNrZXRhcm4gKyAnLyonKVxuICAgICAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgLFxuICAgICAgICAgICAgICAgICdJbnB1dFN0cmVhbVJlYWRQZXJtaXNzaW9ucyc6IG5ldyBQb2xpY3lEb2N1bWVudCgpXG4gICAgICAgICAgICAgICAgICAgIC5hZGRTdGF0ZW1lbnQobmV3IElBTS5Qb2xpY3lTdGF0ZW1lbnQoKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmFsbG93KClcbiAgICAgICAgICAgICAgICAgICAgICAgIC5hZGRBY3Rpb24oJ2tpbmVzaXM6RGVzY3JpYmVTdHJlYW0nKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmFkZEFjdGlvbigna2luZXNpczpHZXRTaGFyZEl0ZXJhdG9yJylcbiAgICAgICAgICAgICAgICAgICAgICAgIC5hZGRBY3Rpb24oJ2tpbmVzaXM6R2V0UmVjb3JkcycpXG4gICAgICAgICAgICAgICAgICAgICAgICAuYWRkUmVzb3VyY2UodGhpcy5raW5lc2lzU3RyZWFtcy5zdHJlYW1Bcm4pXG4gICAgICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgICAsXG4gICAgICAgICAgICAgICAgJ0dsdWVQZXJtaXNzaW9ucyc6IG5ldyBQb2xpY3lEb2N1bWVudCgpXG4gICAgICAgICAgICAgICAgICAgIC5hZGRTdGF0ZW1lbnQobmV3IElBTS5Qb2xpY3lTdGF0ZW1lbnQoKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmFsbG93KClcbiAgICAgICAgICAgICAgICAgICAgICAgIC5hZGRBbGxSZXNvdXJjZXMoKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmFkZEFjdGlvbignZ2x1ZTpHZXRUYWJsZVZlcnNpb25zJylcbiAgICAgICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICAgICxcbiAgICAgICAgICAgICAgICAnQ2xvdWRXYXRjaExvZ3NQZXJtaXNzaW9ucyc6IG5ldyBQb2xpY3lEb2N1bWVudCgpXG4gICAgICAgICAgICAgICAgICAgIC5hZGRTdGF0ZW1lbnQobmV3IElBTS5Qb2xpY3lTdGF0ZW1lbnQoKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmFsbG93KClcbiAgICAgICAgICAgICAgICAgICAgICAgIC5hZGRBY3Rpb24oJ2xvZ3M6UHV0TG9nRXZlbnRzJylcbiAgICAgICAgICAgICAgICAgICAgICAgIC5hZGRSZXNvdXJjZSgnYXJuOmF3czpsb2dzOicgKyBwcm9wcy5yZWdpb24gKyAnOicgKyBwcm9wcy5hY2NvdW50SWQgKyAnOmxvZy1ncm91cDonICsgZmlyZWhvc2VMb2dHcm91cCArICc6KjoqJylcbiAgICAgICAgICAgICAgICAgICAgICAgIC5hZGRSZXNvdXJjZSgnYXJuOmF3czpsb2dzOicgKyBwcm9wcy5yZWdpb24gKyAnOicgKyBwcm9wcy5hY2NvdW50SWQgKyAnOmxvZy1ncm91cDonICsgZmlyZWhvc2VMb2dHcm91cClcbiAgICAgICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICB0aGlzLmtpbmVzaXNGaXJlaG9zZSA9IG5ldyBLREYuQ2ZuRGVsaXZlcnlTdHJlYW0odGhpcywgcHJvcHMuZ2V0QXBwUmVmTmFtZSgpICsgJ1Jhd0RhdGEnLCB7XG4gICAgICAgICAgICBkZWxpdmVyeVN0cmVhbVR5cGU6ICdLaW5lc2lzU3RyZWFtQXNTb3VyY2UnLFxuICAgICAgICAgICAgZGVsaXZlcnlTdHJlYW1OYW1lOiBwcm9wcy5nZXRBcHBSZWZOYW1lKCkgKyAnRmlyZWhvc2UnLFxuICAgICAgICAgICAga2luZXNpc1N0cmVhbVNvdXJjZUNvbmZpZ3VyYXRpb246IHtcbiAgICAgICAgICAgICAgICBraW5lc2lzU3RyZWFtQXJuOiB0aGlzLmtpbmVzaXNTdHJlYW1zLnN0cmVhbUFybixcbiAgICAgICAgICAgICAgICByb2xlQXJuOiBmaXJlaG9zZVJvbGUucm9sZUFyblxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLCBzM0Rlc3RpbmF0aW9uQ29uZmlndXJhdGlvbjoge1xuICAgICAgICAgICAgICAgIGJ1Y2tldEFybjogPHN0cmluZz50aGlzLnJhd2J1Y2tldGFybixcbiAgICAgICAgICAgICAgICBidWZmZXJpbmdIaW50czoge1xuICAgICAgICAgICAgICAgICAgICBpbnRlcnZhbEluU2Vjb25kczogOTAwLFxuICAgICAgICAgICAgICAgICAgICBzaXplSW5NQnM6IDEwXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBjb21wcmVzc2lvbkZvcm1hdDogJ0daSVAnLFxuICAgICAgICAgICAgICAgIHJvbGVBcm46IGZpcmVob3NlUm9sZS5yb2xlQXJuLFxuICAgICAgICAgICAgICAgIGNsb3VkV2F0Y2hMb2dnaW5nT3B0aW9uczoge1xuICAgICAgICAgICAgICAgICAgICBlbmFibGVkOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICBsb2dHcm91cE5hbWU6IGZpcmVob3NlTG9nR3JvdXAsXG4gICAgICAgICAgICAgICAgICAgIGxvZ1N0cmVhbU5hbWU6IGZpcmVob3NlTG9nR3JvdXBcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pXG4gICAgICAgICovXG4gICAgXG4gICAgfVxuXG4gICAgY3JlYXRlQVBJR2F0ZXdheShwcm9wczogSVBhcmFtZXRlckF3YXJlUHJvcHMpIHtcblxuICAgICAgICBsZXQgYXBpcm9sZSA9IG5ldyBJQU0uUm9sZSh0aGlzLCBwcm9wcy5nZXRBcHBSZWZOYW1lKCkgKyAnQVBJUm9sZScsIHtcbiAgICAgICAgICAgIHJvbGVOYW1lOiBwcm9wcy5nZXRBcHBSZWZOYW1lKCkgKyAnQVBJJ1xuICAgICAgICAgICAgLCBhc3N1bWVkQnk6IG5ldyBJQU0uU2VydmljZVByaW5jaXBhbCgnYXBpZ2F0ZXdheS5hbWF6b25hd3MuY29tJylcbiAgICAgICAgICAgICwgaW5saW5lUG9saWNpZXM6IHtcbiAgICAgICAgICAgICAgICAnTGFtYmRhUGVybWlzc2lvbnMnOlxuICAgICAgICAgICAgICAgICAgICBuZXcgUG9saWN5RG9jdW1lbnQoKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmFkZFN0YXRlbWVudChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBuZXcgSUFNLlBvbGljeVN0YXRlbWVudCgpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5hbGxvdygpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5hZGRBY3Rpb24oJ2xhbWJkYTpJbnZva2VGdW5jdGlvbicpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5hZGRBY3Rpb24oJ2xhbWJkYTpJbnZva2VBc3luYycpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5hZGRSZXNvdXJjZSgnYXJuOmF3czpsYW1iZGE6JyArIHByb3BzLnJlZ2lvbiArICc6JyArIHByb3BzLmFjY291bnRJZCArICc6ZnVuY3Rpb246JyArIHByb3BzLmdldEFwcFJlZk5hbWUoKSArICcqJylcbiAgICAgICAgICAgICAgICAgICAgICAgICksXG4gICAgICAgICAgICAgICAgJ1NTTVBlcm1pc3Npb25zJzpcbiAgICAgICAgICAgICAgICAgICAgbmV3IFBvbGljeURvY3VtZW50KClcbiAgICAgICAgICAgICAgICAgICAgICAgIC5hZGRTdGF0ZW1lbnQoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbmV3IElBTS5Qb2xpY3lTdGF0ZW1lbnQoKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuYWxsb3coKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuYWRkQWN0aW9ucyhcInNzbTpHZXRQYXJhbWV0ZXJIaXN0b3J5XCIpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5hZGRBY3Rpb24oXCJzc206R2V0UGFyYW1ldGVyc0J5UGF0aFwiKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuYWRkQWN0aW9uKFwic3NtOkdldFBhcmFtZXRlcnNcIilcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLmFkZEFjdGlvbihcInNzbTpHZXRQYXJhbWV0ZXJcIilcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLmFkZFJlc291cmNlKCdhcm46YXdzOnNzbTonLmNvbmNhdChwcm9wcy5yZWdpb24hLCAnOicsIHByb3BzLmFjY291bnRJZCEsICc6cGFyYW1ldGVyLycsIHByb3BzLmdldEFwcFJlZk5hbWUoKS50b0xvd2VyQ2FzZSgpLCAnLyonKSlcbiAgICAgICAgICAgICAgICAgICAgICAgICksXG4gICAgICAgICAgICAgICAgJ0R5bmFtb0RCUGVybWlzc2lvbnMnOlxuICAgICAgICAgICAgICAgICAgICBuZXcgUG9saWN5RG9jdW1lbnQoKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmFkZFN0YXRlbWVudChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBuZXcgSUFNLlBvbGljeVN0YXRlbWVudCgpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5hbGxvdygpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5hZGRBY3Rpb24oJ2R5bmFtb2RiOkdldEl0ZW0nKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuYWRkUmVzb3VyY2VzKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICg8VGFibGU+cHJvcHMuZ2V0UGFyYW1ldGVyKCd0YWJsZS5zZXNzaW9uJykpLnRhYmxlQXJuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAsKDxUYWJsZT5wcm9wcy5nZXRQYXJhbWV0ZXIoJ3RhYmxlLnNlc3Npb250b3B4JykpLnRhYmxlQXJuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgICAgICAgICAgICksXG4gICAgICAgICAgICAgICAgJ0tpbmVzaXNQZXJtaXNzaW9ucyc6XG4gICAgICAgICAgICAgICAgICAgIG5ldyBQb2xpY3lEb2N1bWVudCgpXG4gICAgICAgICAgICAgICAgICAgICAgICAuYWRkU3RhdGVtZW50KFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5ldyBJQU0uUG9saWN5U3RhdGVtZW50KClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLmFkZEFjdGlvbigna2luZXNpczpQdXRSZWNvcmQnKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuYWRkQWN0aW9uKCdraW5lc2lzOlB1dFJlY29yZHMnKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuYWRkUmVzb3VyY2UodGhpcy5raW5lc2lzU3RyZWFtcy5zdHJlYW1Bcm4pXG4gICAgICAgICAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgICBhcGlyb2xlLmF0dGFjaE1hbmFnZWRQb2xpY3koJ2Fybjphd3M6aWFtOjphd3M6cG9saWN5L3NlcnZpY2Utcm9sZS9BbWF6b25BUElHYXRld2F5UHVzaFRvQ2xvdWRXYXRjaExvZ3MnKTtcblxuICAgICAgICB0aGlzLmFwaSA9IG5ldyBBUElHVFcuQ2ZuUmVzdEFwaSh0aGlzLCBwcm9wcy5nZXRBcHBSZWZOYW1lKCkgKyBcIkFQSVwiLCB7XG4gICAgICAgICAgICAgIG5hbWU6IHByb3BzLmdldEFwcFJlZk5hbWUoKS50b0xvd2VyQ2FzZSgpXG4gICAgICAgICAgICAsIGRlc2NyaXB0aW9uOiAnQVBJIHN1cHBvcnRpbmcgdGhlIGFwcGxpY2F0aW9uICcgKyBwcm9wcy5nZXRBcHBSZWZOYW1lKClcblxuICAgICAgICB9KTtcblxuICAgICAgICBuZXcgQVBJR1RXLkNmbkdhdGV3YXlSZXNwb25zZSh0aGlzLHByb3BzLmdldEFwcFJlZk5hbWUoKSsnR1RXUmVzcG9uc2UnLCB7XG4gICAgICAgICAgICByZXN0QXBpSWQgOiB0aGlzLmFwaS5yZXN0QXBpSWRcbiAgICAgICAgICAgICxyZXNwb25zZVR5cGUgOiAnREVGQVVMVF80WFgnXG4gICAgICAgICAgICAscmVzcG9uc2VQYXJhbWV0ZXJzIDoge1xuICAgICAgICAgICAgXCJnYXRld2F5cmVzcG9uc2UuaGVhZGVyLkFjY2Vzcy1Db250cm9sLUFsbG93LUhlYWRlcnNcIjogXCInQ29udGVudC1UeXBlLFgtQW16LURhdGUsQXV0aG9yaXphdGlvbixYLUFwaS1LZXksWC1BbXotU2VjdXJpdHktVG9rZW4nXCIsXG4gICAgICAgICAgICBcImdhdGV3YXlyZXNwb25zZS5oZWFkZXIuQWNjZXNzLUNvbnRyb2wtQWxsb3ctTWV0aG9kc1wiOiBcIicqJ1wiLFxuICAgICAgICAgICAgXCJnYXRld2F5cmVzcG9uc2UuaGVhZGVyLkFjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpblwiOiBcIicqJ1wiXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAscmVzcG9uc2VUZW1wbGF0ZXMgOiB7XG4gICAgICAgICAgICBcImFwcGxpY2F0aW9uL2pzb25cIjogXCJ7XFxcIm1lc3NhZ2VcXFwiOiRjb250ZXh0LmVycm9yLm1lc3NhZ2VTdHJpbmd9XCJcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSkuYWRkRGVwZW5kc09uKHRoaXMuYXBpKTtcblxuICAgICAgICBsZXQgYXV0aG9yaXplciA9IG5ldyBBUElHVFcuQ2ZuQXV0aG9yaXplcih0aGlzLCBwcm9wcy5nZXRBcHBSZWZOYW1lKCkgKyBcIkF1dGhvcml6ZXJcIiwge1xuICAgICAgICAgICAgbmFtZTogcHJvcHMuZ2V0QXBwUmVmTmFtZSgpLnRvTG93ZXJDYXNlKCkgKyAnQXV0aG9yaXplcidcbiAgICAgICAgICAgICwgcmVzdEFwaUlkOiB0aGlzLmFwaS5yZXN0QXBpSWRcbiAgICAgICAgICAgICwgdHlwZTogJ0NPR05JVE9fVVNFUl9QT09MUydcbiAgICAgICAgICAgICwgaWRlbnRpdHlTb3VyY2U6ICdtZXRob2QucmVxdWVzdC5oZWFkZXIuQXV0aG9yaXphdGlvbidcbiAgICAgICAgICAgICwgcHJvdmlkZXJBcm5zOiBbXG4gICAgICAgICAgICAgICAgdGhpcy51c2VycG9vbFxuICAgICAgICAgICAgXVxuICAgICAgICB9KTtcblxuICAgICAgICBsZXQgYXBpTW9kZWxTY29yZWJvYXJkUmVzcG9uc2UgPSBuZXcgQVBJR1RXLkNmbk1vZGVsKHRoaXMsIHByb3BzLmdldEFwcFJlZk5hbWUoKSArICdBUElNb2RlbFNjb3JlYm9hcmRSZXNwb25zZU1vZGVsJywge1xuICAgICAgICAgICAgY29udGVudFR5cGU6ICdhcHBsaWNhdGlvbi9qc29uJ1xuICAgICAgICAgICAgLCBkZXNjcmlwdGlvbjogJ1Njb3JlYm9hcmQgcmVzcG9uc2UgbW9kZWwgKGZvciAvc2NvcmVib2FyZC9HRVQpJ1xuICAgICAgICAgICAgLCBuYW1lOiAnU2NvcmVib2FyZFJlc3BvbnNlTW9kZWwnXG4gICAgICAgICAgICAsIHJlc3RBcGlJZDogdGhpcy5hcGkucmVzdEFwaUlkXG4gICAgICAgICAgICAsIHNjaGVtYToge1xuICAgICAgICAgICAgICAgIFwiJHNjaGVtYVwiOiBcImh0dHA6Ly9qc29uLXNjaGVtYS5vcmcvZHJhZnQtMDQvc2NoZW1hI1wiLFxuICAgICAgICAgICAgICAgIFwidGl0bGVcIjogXCJTY29yZWJvYXJkUmVzcG9uc2VNb2RlbFwiLFxuICAgICAgICAgICAgICAgIFwidHlwZVwiOiBcIm9iamVjdFwiLFxuICAgICAgICAgICAgICAgIFwicHJvcGVydGllc1wiOiB7XG4gICAgICAgICAgICAgICAgICAgIFwiU2NvcmVib2FyZFwiOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBcInR5cGVcIjogXCJhcnJheVwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgXCJpdGVtc1wiOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXCIkcmVmXCI6IFwiIy9kZWZpbml0aW9ucy9HYW1lclNjb3JlXCJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgXCJkZWZpbml0aW9uc1wiOiB7XG4gICAgICAgICAgICAgICAgICAgIFwiR2FtZXJTY29yZVwiOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBcInR5cGVcIjogXCJvYmplY3RcIixcbiAgICAgICAgICAgICAgICAgICAgICAgIFwicHJvcGVydGllc1wiOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJOYW1lXCI6IHsgXCJ0eXBlXCI6IFwiaW50ZWdlclwiIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJTY29yZVwiOiB7IFwidHlwZVwiOiBcImludGVnZXJcIiB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiTGV2ZWxcIjogeyBcInR5cGVcIjogXCJpbnRlZ2VyXCIgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBcIlNob3RzXCI6IHsgXCJ0eXBlXCI6IFwiaW50ZWdlclwiIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJOaWNrbmFtZVwiOiB7IFwidHlwZVwiOiBcInN0cmluZ1wiIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJMaXZlc1wiOiB7IFwidHlwZVwiOiBcImludGVnZXJcIiB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGxldCBhcGlNb2RlbEdldFBhcmFtZXRlcnNSZXF1ZXN0ID0gbmV3IEFQSUdUVy5DZm5Nb2RlbCh0aGlzLCBwcm9wcy5nZXRBcHBSZWZOYW1lKCkgKyAnQVBJTW9kZWxHZXRQYXJhbWV0ZXJzUmVxdWVzdCcsIHtcbiAgICAgICAgICAgIGNvbnRlbnRUeXBlOiAnYXBwbGljYXRpb24vanNvbidcbiAgICAgICAgICAgICwgZGVzY3JpcHRpb246ICdNb2RlbCB0byByZXF1ZXN0IFNTTTpHZXRQYXJhbWV0ZXJzJ1xuICAgICAgICAgICAgLCBuYW1lOiAnR2V0UGFyYW1ldGVyc1JlcXVlc3QnXG4gICAgICAgICAgICAsIHJlc3RBcGlJZDogdGhpcy5hcGkucmVzdEFwaUlkXG4gICAgICAgICAgICAsIHNjaGVtYToge1xuICAgICAgICAgICAgICAgIFwiJHNjaGVtYVwiOiBcImh0dHA6Ly9qc29uLXNjaGVtYS5vcmcvZHJhZnQtMDQvc2NoZW1hI1wiLFxuICAgICAgICAgICAgICAgIFwidGl0bGVcIjogXCJHZXRQYXJhbWV0ZXJzUmVxdWVzdFwiLFxuICAgICAgICAgICAgICAgIFwidHlwZVwiOiBcIm9iamVjdFwiLFxuICAgICAgICAgICAgICAgIFwicHJvcGVydGllc1wiOiB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZXNcIjogeyBcInR5cGVcIjogXCJhcnJheVwiIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vVmVyc2lvbiAxIG9mIHRoZSBBUElcbiAgICAgICAgbGV0IHYxID0gbmV3IEFQSUdUVy5DZm5SZXNvdXJjZSh0aGlzLCBwcm9wcy5nZXRBcHBSZWZOYW1lKCkgKyBcIkFQSXYxXCIsIHtcbiAgICAgICAgICAgIHBhcmVudElkOiB0aGlzLmFwaS5yZXN0QXBpUm9vdFJlc291cmNlSWRcbiAgICAgICAgICAgICwgcGF0aFBhcnQ6ICd2MSdcbiAgICAgICAgICAgICwgcmVzdEFwaUlkOiB0aGlzLmFwaS5yZXN0QXBpSWRcbiAgICAgICAgfSk7XG5cblxuICAgIFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBTRVNTSU9OIHJlc291cmNlIC9zZXNzaW9uXG4gICAgICAgICAqIEdFVCB7bm8gcGFyYW1ldGVyfSAtIHJldHVybnMgc2Vzc2lvbiBkYXRhIGZyb20gc3NtLnBhcmFtZXRlciAvc3NtL3Nlc3Npb25cbiAgICAgICAgICogXG4gICAgICAgICAqL1xuICAgICAgICBsZXQgc2Vzc2lvbiA9IG5ldyBBUElHVFcuQ2ZuUmVzb3VyY2UodGhpcywgcHJvcHMuZ2V0QXBwUmVmTmFtZSgpICsgXCJBUEl2MXNlc3Npb25cIiwge1xuICAgICAgICAgICAgcGFyZW50SWQ6IHYxLnJlc291cmNlSWRcbiAgICAgICAgICAgICwgcGF0aFBhcnQ6ICdzZXNzaW9uJ1xuICAgICAgICAgICAgLCByZXN0QXBpSWQ6IHRoaXMuYXBpLnJlc3RBcGlJZFxuICAgICAgICB9KTtcblxuICAgICAgICBsZXQgc2Vzc2lvbkdldE1ldGhvZCA9IG5ldyBBUElHVFcuQ2ZuTWV0aG9kKHRoaXMsIHByb3BzLmdldEFwcFJlZk5hbWUoKSArIFwiQVBJdjFzZXNzaW9uR0VUXCIsIHtcbiAgICAgICAgICAgIHJlc3RBcGlJZDogdGhpcy5hcGkucmVzdEFwaUlkXG4gICAgICAgICAgICAsIHJlc291cmNlSWQ6IHNlc3Npb24ucmVzb3VyY2VJZFxuICAgICAgICAgICAgLCBhdXRob3JpemF0aW9uVHlwZTogQVBJR1RXLkF1dGhvcml6YXRpb25UeXBlLkNvZ25pdG9cbiAgICAgICAgICAgICwgYXV0aG9yaXplcklkOiBhdXRob3JpemVyLmF1dGhvcml6ZXJJZFxuICAgICAgICAgICAgLCBodHRwTWV0aG9kOiAnR0VUJ1xuICAgICAgICAgICAgLCByZXF1ZXN0UGFyYW1ldGVyczoge1xuICAgICAgICAgICAgICAgICAgJ21ldGhvZC5yZXF1ZXN0LnF1ZXJ5c3RyaW5nLk5hbWUnOiB0cnVlXG4gICAgICAgICAgICAgICAgLCAnbWV0aG9kLnJlcXVlc3QuaGVhZGVyLkF1dGhlbnRpY2F0aW9uJzogdHJ1ZVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLCByZXF1ZXN0TW9kZWxzIDogdW5kZWZpbmVkXG4gICAgICAgICAgICAsIGludGVncmF0aW9uOiB7XG4gICAgICAgICAgICAgICAgcGFzc3Rocm91Z2hCZWhhdmlvcjogJ1dIRU5fTk9fTUFUQ0gnXG4gICAgICAgICAgICAgICAgLCBpbnRlZ3JhdGlvbkh0dHBNZXRob2Q6ICdQT1NUJ1xuICAgICAgICAgICAgICAgICwgdHlwZTogJ0FXUydcbiAgICAgICAgICAgICAgICAsIHVyaTogJ2Fybjphd3M6YXBpZ2F0ZXdheTonICsgcHJvcHMucmVnaW9uICsgJzpzc206YWN0aW9uL0dldFBhcmFtZXRlcidcbiAgICAgICAgICAgICAgICAsIGNyZWRlbnRpYWxzOiBhcGlyb2xlLnJvbGVBcm5cbiAgICAgICAgICAgICAgICAsIHJlcXVlc3RQYXJhbWV0ZXJzOiB7XG4gICAgICAgICAgICAgICAgICAgICAgJ2ludGVncmF0aW9uLnJlcXVlc3QucXVlcnlzdHJpbmcuTmFtZSc6IFwiJy9cIiArIHByb3BzLmdldEFwcFJlZk5hbWUoKS50b0xvd2VyQ2FzZSgpICsgXCIvc2Vzc2lvbidcIlxuICAgICAgICAgICAgICAgICAgICAsICdpbnRlZ3JhdGlvbi5yZXF1ZXN0LmhlYWRlci5BdXRoZW50aWNhdGlvbic6ICdtZXRob2QucmVxdWVzdC5oZWFkZXIuQXV0aGVudGljYXRpb24nXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICwgcmVxdWVzdFRlbXBsYXRlcyA6IHVuZGVmaW5lZFxuICAgICAgICAgICAgICAgICwgaW50ZWdyYXRpb25SZXNwb25zZXM6IFtcbiAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgc3RhdHVzQ29kZTogJzIwMCdcbiAgICAgICAgICAgICAgICAgICAgICAgICwgcmVzcG9uc2VQYXJhbWV0ZXJzOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJ21ldGhvZC5yZXNwb25zZS5oZWFkZXIuQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luJzogXCInKidcIlxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgLCByZXNwb25zZVRlbXBsYXRlczoge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICdhcHBsaWNhdGlvbi9qc29uJzogYFwiJHV0aWwuZXNjYXBlSmF2YVNjcmlwdChcIiRpbnB1dC5wYXRoKCckJykuR2V0UGFyYW1ldGVyUmVzcG9uc2UuR2V0UGFyYW1ldGVyUmVzdWx0LlBhcmFtZXRlci5WYWx1ZVwiKS5yZXBsYWNlQWxsKFwiXFwnXCIsJ1wiJylcImBcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfV1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgICwgbWV0aG9kUmVzcG9uc2VzOiBbXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBzdGF0dXNDb2RlOiAnMjAwJ1xuICAgICAgICAgICAgICAgICAgICAsIHJlc3BvbnNlUGFyYW1ldGVyczoge1xuICAgICAgICAgICAgICAgICAgICAgICAgJ21ldGhvZC5yZXNwb25zZS5oZWFkZXIuQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luJzogZmFsc2VcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAsIHJlc3BvbnNlTW9kZWxzOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAnYXBwbGljYXRpb24vanNvbic6ICdFbXB0eSdcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIF1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gT1BUSU9OU1xuICAgICAgICBsZXQgc2Vzc2lvbk9wdGlvbnNNZXRob2QgPSBuZXcgQVBJR1RXLkNmbk1ldGhvZCh0aGlzLCBwcm9wcy5nZXRBcHBSZWZOYW1lKCkgKyBcIkFQSXYxc2Vzc2lvbk9QVElPTlNcIiwge1xuICAgICAgICAgICAgcmVzdEFwaUlkOiB0aGlzLmFwaS5yZXN0QXBpSWRcbiAgICAgICAgICAgICwgcmVzb3VyY2VJZDogc2Vzc2lvbi5yZXNvdXJjZUlkXG4gICAgICAgICAgICAsIGF1dGhvcml6YXRpb25UeXBlOiBBUElHVFcuQXV0aG9yaXphdGlvblR5cGUuTm9uZVxuICAgICAgICAgICAgLCBodHRwTWV0aG9kOiAnT1BUSU9OUydcbiAgICAgICAgICAgICwgaW50ZWdyYXRpb246IHtcbiAgICAgICAgICAgICAgICBwYXNzdGhyb3VnaEJlaGF2aW9yOiAnV0hFTl9OT19NQVRDSCdcbiAgICAgICAgICAgICAgICAsIHR5cGU6ICdNT0NLJ1xuICAgICAgICAgICAgICAgICwgcmVxdWVzdFRlbXBsYXRlczoge1xuICAgICAgICAgICAgICAgICAgICAnYXBwbGljYXRpb24vanNvbic6ICd7XFxcInN0YXR1c0NvZGVcXFwiOiAyMDB9J1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAsIGludGVncmF0aW9uUmVzcG9uc2VzOiBbXG4gICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0YXR1c0NvZGU6ICcyMDAnXG4gICAgICAgICAgICAgICAgICAgICAgICAsIHJlc3BvbnNlUGFyYW1ldGVyczoge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICdtZXRob2QucmVzcG9uc2UuaGVhZGVyLkFjY2Vzcy1Db250cm9sLUFsbG93LUhlYWRlcnMnIDogXCInQ29udGVudC1UeXBlLFgtQW16LURhdGUsQXV0aG9yaXphdGlvbixYLUFwaS1LZXksWC1BbXotU2VjdXJpdHktVG9rZW4nXCJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAsJ21ldGhvZC5yZXNwb25zZS5oZWFkZXIuQWNjZXNzLUNvbnRyb2wtQWxsb3ctTWV0aG9kcycgOiBcIicqJ1wiXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLCdtZXRob2QucmVzcG9uc2UuaGVhZGVyLkFjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpbicgOiBcIicqJ1wiXG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1dXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAsIG1ldGhvZFJlc3BvbnNlczogW1xuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgc3RhdHVzQ29kZTogJzIwMCdcbiAgICAgICAgICAgICAgICAgICAgLCByZXNwb25zZVBhcmFtZXRlcnM6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgJ21ldGhvZC5yZXNwb25zZS5oZWFkZXIuQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luJzogZmFsc2VcbiAgICAgICAgICAgICAgICAgICAgICAgICwgJ21ldGhvZC5yZXNwb25zZS5oZWFkZXIuQWNjZXNzLUNvbnRyb2wtQWxsb3ctTWV0aG9kcyc6IGZhbHNlXG4gICAgICAgICAgICAgICAgICAgICAgICAsICdtZXRob2QucmVzcG9uc2UuaGVhZGVyLkFjY2Vzcy1Db250cm9sLUFsbG93LUhlYWRlcnMnOiBmYWxzZVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICwgcmVzcG9uc2VNb2RlbHM6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIFwiYXBwbGljYXRpb24vanNvblwiOiAnRW1wdHknXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICBdXG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBDT05GSUcgXG4gICAgICAgICAqIFJlc291cmNlOiAvY29uZmlnXG4gICAgICAgICAqIE1ldGhvZDogR0VUIFxuICAgICAgICAgKiBSZXF1ZXN0IFBhcmFtZXRlcnMgOiBub25lXG4gICAgICAgICAqIFJlc3BvbnNlIGZvcm1hdDpcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgIFwiUGFyYW1ldGVyc1wiOiBbXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIFwiTmFtZVwiOiBcIi88YXBwPi9jbGllbnRpZFwiLFxuICAgICAgICAgICAgICAgIFwiVmFsdWVcIjogXCI0dGZlNWwyNmtkcDU5dGM0azR2MGI2ODhubVwiXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgXCJOYW1lXCI6IFwiLzxhcHA+L2lkZW50aXR5cG9vbGlkXCIsXG4gICAgICAgICAgICAgICAgXCJWYWx1ZVwiOiBcIjxyZWdpb24+OjE3MDkyZGY2LTdlM2EtNDg5My00ZDg1LWM2ZGUzM2NkZmFiY1wiXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgXCJOYW1lXCI6IFwiLzxhcHA+Pi91c2VycG9vbGlkXCIsXG4gICAgICAgICAgICAgICAgXCJWYWx1ZVwiOiBcIjxyZWdpb24+X3VlTGZkYVNYaVwiXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgXCJOYW1lXCI6IFwiLzxhcHA+Pi91c2VycG9vbHVybFwiLFxuICAgICAgICAgICAgICAgIFwiVmFsdWVcIjogXCJjb2duaXRvLWlkcC48cmVnaW9uPj4uYW1hem9uYXdzLmNvbS88cmVnaW9uPl91ZUxmZGFTWGlcIlxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIF1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICovXG4gICAgICAgIGxldCBjb25maWcgPSBuZXcgQVBJR1RXLkNmblJlc291cmNlKHRoaXMsIHByb3BzLmdldEFwcFJlZk5hbWUoKSArIFwiQVBJdjFjb25maWdcIiwge1xuICAgICAgICAgICAgcGFyZW50SWQ6IHYxLnJlc291cmNlSWRcbiAgICAgICAgICAgICwgcGF0aFBhcnQ6ICdjb25maWcnXG4gICAgICAgICAgICAsIHJlc3RBcGlJZDogdGhpcy5hcGkucmVzdEFwaUlkXG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIEdFVFxuICAgICAgICBsZXQgY29uZmlnR2V0TWV0aG9kID0gbmV3IEFQSUdUVy5DZm5NZXRob2QodGhpcywgcHJvcHMuZ2V0QXBwUmVmTmFtZSgpICsgXCJBUEl2MWNvbmZpZ0dFVFwiLCB7XG4gICAgICAgICAgICByZXN0QXBpSWQ6IHRoaXMuYXBpLnJlc3RBcGlJZFxuICAgICAgICAgICAgLCByZXNvdXJjZUlkOiBjb25maWcucmVzb3VyY2VJZFxuICAgICAgICAgICAgLCBhdXRob3JpemF0aW9uVHlwZTogQVBJR1RXLkF1dGhvcml6YXRpb25UeXBlLk5vbmVcbiAgICAgICAgICAgICwgaHR0cE1ldGhvZDogJ0dFVCdcbiAgICAgICAgICAgICwgcmVxdWVzdFBhcmFtZXRlcnM6IHtcbiAgICAgICAgICAgICAgICAnbWV0aG9kLnJlcXVlc3QuaGVhZGVyLkNvbnRlbnQtVHlwZSc6IHRydWVcbiAgICAgICAgICAgICAgICAsICdtZXRob2QucmVxdWVzdC5oZWFkZXIuWC1BbXotVGFyZ2V0JzogdHJ1ZVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLCByZXF1ZXN0TW9kZWxzOiB7XG4gICAgICAgICAgICAgICAgJ2FwcGxpY2F0aW9uL2pzb24nOiBhcGlNb2RlbEdldFBhcmFtZXRlcnNSZXF1ZXN0LnJlZlxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLCBpbnRlZ3JhdGlvbjoge1xuICAgICAgICAgICAgICAgIGludGVncmF0aW9uSHR0cE1ldGhvZDogJ1BPU1QnXG4gICAgICAgICAgICAgICAgLCB0eXBlOiAnQVdTJ1xuICAgICAgICAgICAgICAgICwgdXJpOiAnYXJuOmF3czphcGlnYXRld2F5OicgKyBwcm9wcy5yZWdpb24gKyAnOnNzbTpwYXRoLy8nXG4gICAgICAgICAgICAgICAgLCBjcmVkZW50aWFsczogYXBpcm9sZS5yb2xlQXJuXG4gICAgICAgICAgICAgICAgLCByZXF1ZXN0UGFyYW1ldGVyczoge1xuICAgICAgICAgICAgICAgICAgICAnaW50ZWdyYXRpb24ucmVxdWVzdC5oZWFkZXIuQ29udGVudC1UeXBlJzogXCInYXBwbGljYXRpb24veC1hbXotanNvbi0xLjEnXCJcbiAgICAgICAgICAgICAgICAgICAgLCAnaW50ZWdyYXRpb24ucmVxdWVzdC5oZWFkZXIuWC1BbXotVGFyZ2V0JzogXCInQW1hem9uU1NNLkdldFBhcmFtZXRlcnMnXCJcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLCByZXF1ZXN0VGVtcGxhdGVzOiB7XG4gICAgICAgICAgICAgICAgICAgICdhcHBsaWNhdGlvbi9qc29uJzogJ3tcIk5hbWVzXCIgOiBbJyArXG4gICAgICAgICAgICAgICAgICAgICAgICAnXCIvJyArIHByb3BzLmdldEFwcFJlZk5hbWUoKS50b0xvd2VyQ2FzZSgpICsgJy91c2VycG9vbGlkXCIsJyArXG4gICAgICAgICAgICAgICAgICAgICAgICAnXCIvJyArIHByb3BzLmdldEFwcFJlZk5hbWUoKS50b0xvd2VyQ2FzZSgpICsgJy91c2VycG9vbHVybFwiLCcgK1xuICAgICAgICAgICAgICAgICAgICAgICAgJ1wiLycgKyBwcm9wcy5nZXRBcHBSZWZOYW1lKCkudG9Mb3dlckNhc2UoKSArICcvY2xpZW50aWRcIiwnICtcbiAgICAgICAgICAgICAgICAgICAgICAgICdcIi8nICsgcHJvcHMuZ2V0QXBwUmVmTmFtZSgpLnRvTG93ZXJDYXNlKCkgKyAnL2lkZW50aXR5cG9vbGlkXCInICtcbiAgICAgICAgICAgICAgICAgICAgICAgICddfSdcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLCBwYXNzdGhyb3VnaEJlaGF2aW9yOiAnV0hFTl9OT19URU1QTEFURVMnXG4gICAgICAgICAgICAgICAgLCBpbnRlZ3JhdGlvblJlc3BvbnNlczogW1xuICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzdGF0dXNDb2RlOiAnMjAwJ1xuICAgICAgICAgICAgICAgICAgICAgICAgLCByZXNwb25zZVBhcmFtZXRlcnM6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAnbWV0aG9kLnJlc3BvbnNlLmhlYWRlci5BY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4nOiBcIicqJ1wiXG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAsIHJlc3BvbnNlVGVtcGxhdGVzOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJ2FwcGxpY2F0aW9uL2pzb24nOiBgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICNzZXQoJGlucHV0Um9vdCA9ICRpbnB1dC5wYXRoKCckJykpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiUGFyYW1ldGVyc1wiIDogW1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICNmb3JlYWNoKCRlbGVtIGluICRpbnB1dFJvb3QuUGFyYW1ldGVycylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiTmFtZVwiIDogXCIkZWxlbS5OYW1lXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiVmFsdWVcIiA6ICBcIiR1dGlsLmVzY2FwZUphdmFTY3JpcHQoXCIkZWxlbS5WYWx1ZVwiKS5yZXBsYWNlQWxsKFwiJ1wiLCdcIicpXCJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICNpZigkZm9yZWFjaC5oYXNOZXh0KSwjZW5kXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAjZW5kXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfWBcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfV1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgICwgbWV0aG9kUmVzcG9uc2VzOiBbXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBzdGF0dXNDb2RlOiAnMjAwJ1xuICAgICAgICAgICAgICAgICAgICAsIHJlc3BvbnNlUGFyYW1ldGVyczoge1xuICAgICAgICAgICAgICAgICAgICAgICAgJ21ldGhvZC5yZXNwb25zZS5oZWFkZXIuQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luJzogdHJ1ZVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAsIHJlc3BvbnNlTW9kZWxzOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICdhcHBsaWNhdGlvbi9qc29uJzogJ0VtcHR5J1xuICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICBdXG4gICAgICAgIH0pO1xuXG5cbiAgICAgICAgLy8gT1BUSU9OU1xuICAgICAgICBsZXQgY29uZmlnT3B0aW9uc01ldGhvZCA9IG5ldyBBUElHVFcuQ2ZuTWV0aG9kKHRoaXMsIHByb3BzLmdldEFwcFJlZk5hbWUoKSArIFwiQVBJdjFjb25maWdPUFRJT05TXCIsIHtcbiAgICAgICAgICAgIHJlc3RBcGlJZDogdGhpcy5hcGkucmVzdEFwaUlkXG4gICAgICAgICAgICAsIHJlc291cmNlSWQ6IGNvbmZpZy5yZXNvdXJjZUlkXG4gICAgICAgICAgICAsIGF1dGhvcml6YXRpb25UeXBlOiBBUElHVFcuQXV0aG9yaXphdGlvblR5cGUuTm9uZVxuICAgICAgICAgICAgLCBodHRwTWV0aG9kOiAnT1BUSU9OUydcbiAgICAgICAgICAgICwgaW50ZWdyYXRpb246IHtcbiAgICAgICAgICAgICAgICBwYXNzdGhyb3VnaEJlaGF2aW9yOiAnd2hlbl9ub19tYXRjaCdcbiAgICAgICAgICAgICAgICAsIHR5cGU6ICdNT0NLJ1xuICAgICAgICAgICAgICAgICwgcmVxdWVzdFRlbXBsYXRlczoge1xuICAgICAgICAgICAgICAgICAgICAnYXBwbGljYXRpb24vanNvbic6IGB7XFxcInN0YXR1c0NvZGVcXFwiOiAyMDB9YFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAsIGludGVncmF0aW9uUmVzcG9uc2VzOiBbXG4gICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0YXR1c0NvZGU6ICcyMDAnXG4gICAgICAgICAgICAgICAgICAgICAgICAsIHJlc3BvbnNlUGFyYW1ldGVyczoge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAnbWV0aG9kLnJlc3BvbnNlLmhlYWRlci5BY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4nOiBcIicqJ1wiXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLCAnbWV0aG9kLnJlc3BvbnNlLmhlYWRlci5BY2Nlc3MtQ29udHJvbC1BbGxvdy1NZXRob2RzJzogXCInKidcIlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICwgJ21ldGhvZC5yZXNwb25zZS5oZWFkZXIuQWNjZXNzLUNvbnRyb2wtQWxsb3ctSGVhZGVycyc6IFwiJ0NvbnRlbnQtVHlwZSxBdXRob3JpemF0aW9uLFgtQW16LURhdGUsWC1BcGktS2V5LFgtQW16LVNlY3VyaXR5LVRva2VuJ1wiXG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1dXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAsIG1ldGhvZFJlc3BvbnNlczogW1xuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgc3RhdHVzQ29kZTogJzIwMCdcbiAgICAgICAgICAgICAgICAgICAgLCByZXNwb25zZVBhcmFtZXRlcnM6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgJ21ldGhvZC5yZXNwb25zZS5oZWFkZXIuQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luJzogdHJ1ZVxuICAgICAgICAgICAgICAgICAgICAgICAgLCAnbWV0aG9kLnJlc3BvbnNlLmhlYWRlci5BY2Nlc3MtQ29udHJvbC1BbGxvdy1NZXRob2RzJzogdHJ1ZVxuICAgICAgICAgICAgICAgICAgICAgICAgLCAnbWV0aG9kLnJlc3BvbnNlLmhlYWRlci5BY2Nlc3MtQ29udHJvbC1BbGxvdy1IZWFkZXJzJzogdHJ1ZVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICwgcmVzcG9uc2VNb2RlbHM6IHtcbiAgICAgICAgICAgICAgICAgICAgICdhcHBsaWNhdGlvbi9qc29uJzogJ0VtcHR5J1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgXVxuICAgICAgICB9KTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQUxMT0NBVEUgXG4gICAgICAgICAqIFJlc291cmNlOiAvYWxsb2NhdGVcbiAgICAgICAgICogTWV0aG9kOiBQT1NUXG4gICAgICAgICAqIFJlcXVlc3QgZm9ybWF0OiB7ICdVc2VybmFtZScgOiAnPHRoZSB1c2VyIG5hbWU+J31cbiAgICAgICAgICovXG4gICAgICAgIGxldCBhbGxvY2F0ZSA9IG5ldyBBUElHVFcuQ2ZuUmVzb3VyY2UodGhpcywgcHJvcHMuZ2V0QXBwUmVmTmFtZSgpICsgXCJBUEl2MWFsbG9jYXRlXCIsIHtcbiAgICAgICAgICAgIHBhcmVudElkOiB2MS5yZXNvdXJjZUlkXG4gICAgICAgICAgICAsIHBhdGhQYXJ0OiAnYWxsb2NhdGUnXG4gICAgICAgICAgICAsIHJlc3RBcGlJZDogdGhpcy5hcGkucmVzdEFwaUlkXG4gICAgICAgIH0pO1xuXG5cbiAgICAgICAgbGV0IGxhbWJkYUFsbG9jYXRlID0gKDxMYW1iZGEuRnVuY3Rpb24+IHByb3BzLmdldFBhcmFtZXRlcignbGFtYmRhLmFsbG9jYXRlJykpO1xuXG4gICAgICAgIC8vIFBPU1RcbiAgICAgICAgbGV0IGFsbG9jYXRlUG9zdE1ldGhvZCA9IG5ldyBBUElHVFcuQ2ZuTWV0aG9kKHRoaXMsIHByb3BzLmdldEFwcFJlZk5hbWUoKSArIFwiQVBJdjFhbGxvY2F0ZVBPU1RcIiwge1xuICAgICAgICAgICAgcmVzdEFwaUlkOiB0aGlzLmFwaS5yZXN0QXBpSWRcbiAgICAgICAgICAgICwgcmVzb3VyY2VJZDogYWxsb2NhdGUucmVzb3VyY2VJZFxuICAgICAgICAgICAgLCBhdXRob3JpemF0aW9uVHlwZTogQVBJR1RXLkF1dGhvcml6YXRpb25UeXBlLkNvZ25pdG9cbiAgICAgICAgICAgICwgYXV0aG9yaXplcklkOiBhdXRob3JpemVyLmF1dGhvcml6ZXJJZFxuICAgICAgICAgICAgLCBodHRwTWV0aG9kOiAnUE9TVCdcbiAgICAgICAgICAgICwgaW50ZWdyYXRpb246IHtcbiAgICAgICAgICAgICAgICBwYXNzdGhyb3VnaEJlaGF2aW9yOiAnV0hFTl9OT19NQVRDSCdcbiAgICAgICAgICAgICAgICAsIGludGVncmF0aW9uSHR0cE1ldGhvZDogJ1BPU1QnXG4gICAgICAgICAgICAgICAgLCB0eXBlOiAnQVdTX1BST1hZJ1xuICAgICAgICAgICAgICAgICwgdXJpOiAnYXJuOmF3czphcGlnYXRld2F5OicgKyBwcm9wcy5yZWdpb24gKyAnOmxhbWJkYTpwYXRoLzIwMTUtMDMtMzEvZnVuY3Rpb25zLycgKyBsYW1iZGFBbGxvY2F0ZS5mdW5jdGlvbkFybiArICcvaW52b2NhdGlvbnMnXG4gICAgICAgICAgICAgICAgLCBjcmVkZW50aWFsczogYXBpcm9sZS5yb2xlQXJuXG4gICAgICAgICAgICAgIC8vICAsIHVyaTogJ2Fybjphd3M6YXBpZ2F0ZXdheTonICsgcHJvcHMucmVnaW9uICsgJzpsYW1iZGE6cGF0aC8yMDE1LTAzLTMxL2Z1bmN0aW9ucy8nICsgcHJvcHMuZ2V0UGFyYW1ldGVyKCdsYW1iZGEuYWxsb2NhdGUnKSArICcvaW52b2NhdGlvbnMnXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAsIG1ldGhvZFJlc3BvbnNlczogW1xuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgc3RhdHVzQ29kZTogJzIwMCdcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICBdXG4gICAgICAgIH0pO1xuXG4vKiBUTyBCRSBJTVBMRU1FTlRFRCBPTiBDREtcbiAgICAgICAgbGFtYmRhQWxsb2NhdGUuYWRkRXZlbnRTb3VyY2UoXG4gICAgICAgICAgICBuZXcgQXBpRXZlbnRTb3VyY2UoICdQT1NUJywnL3YxL2FsbG9jYXRlJyx7XG4gICAgICAgICAgICAgICAgICAgYXV0aG9yaXphdGlvblR5cGUgOiBBUElHVFcuQXV0aG9yaXphdGlvblR5cGUuQ29nbml0b1xuICAgICAgICAgICAgICAgICAsIGF1dGhvcml6ZXJJZCA6IGF1dGhvcml6ZXIuYXV0aG9yaXplcklkXG4gICAgICAgICAgICB9KVxuICAgICAgICApO1xuKi9cblxuICAgICAgICAvLyBPUFRJT05TXG4gICAgICAgIGxldCBhbGxvY2F0ZU9wdGlvbnNNZXRob2QgPSBuZXcgQVBJR1RXLkNmbk1ldGhvZCh0aGlzLCBwcm9wcy5nZXRBcHBSZWZOYW1lKCkgKyBcIkFQSXYxYWxsb2NhdGVPUFRJT05TXCIsIHtcbiAgICAgICAgICAgIHJlc3RBcGlJZDogdGhpcy5hcGkucmVzdEFwaUlkXG4gICAgICAgICAgICAsIHJlc291cmNlSWQ6IGFsbG9jYXRlLnJlc291cmNlSWRcbiAgICAgICAgICAgICwgYXV0aG9yaXphdGlvblR5cGU6IEFQSUdUVy5BdXRob3JpemF0aW9uVHlwZS5Ob25lXG4gICAgICAgICAgICAsIGh0dHBNZXRob2Q6ICdPUFRJT05TJ1xuICAgICAgICAgICAgLCBpbnRlZ3JhdGlvbjoge1xuICAgICAgICAgICAgICAgIHBhc3N0aHJvdWdoQmVoYXZpb3I6ICdXSEVOX05PX01BVENIJ1xuICAgICAgICAgICAgICAgICwgdHlwZTogJ01PQ0snXG4gICAgICAgICAgICAgICAgLCByZXF1ZXN0VGVtcGxhdGVzOiB7XG4gICAgICAgICAgICAgICAgICAgICdhcHBsaWNhdGlvbi9qc29uJzogYHtcXFwic3RhdHVzQ29kZVxcXCI6IDIwMH1gXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICwgaW50ZWdyYXRpb25SZXNwb25zZXM6IFtcbiAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgc3RhdHVzQ29kZTogJzIwMCdcbiAgICAgICAgICAgICAgICAgICAgICAgICwgcmVzcG9uc2VQYXJhbWV0ZXJzOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJ21ldGhvZC5yZXNwb25zZS5oZWFkZXIuQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luJzogXCInKidcIlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICwgJ21ldGhvZC5yZXNwb25zZS5oZWFkZXIuQWNjZXNzLUNvbnRyb2wtQWxsb3ctTWV0aG9kcyc6IFwiJyonXCJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAsICdtZXRob2QucmVzcG9uc2UuaGVhZGVyLkFjY2Vzcy1Db250cm9sLUFsbG93LUhlYWRlcnMnOiBcIidDb250ZW50LVR5cGUsQXV0aG9yaXphdGlvbixYLUFtei1EYXRlLFgtQXBpLUtleSxYLUFtei1TZWN1cml0eS1Ub2tlbidcIlxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLCBtZXRob2RSZXNwb25zZXM6IFtcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIHN0YXR1c0NvZGU6ICcyMDAnXG4gICAgICAgICAgICAgICAgICAgICwgcmVzcG9uc2VQYXJhbWV0ZXJzOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAnbWV0aG9kLnJlc3BvbnNlLmhlYWRlci5BY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4nOiB0cnVlXG4gICAgICAgICAgICAgICAgICAgICAgICAsICdtZXRob2QucmVzcG9uc2UuaGVhZGVyLkFjY2Vzcy1Db250cm9sLUFsbG93LU1ldGhvZHMnOiB0cnVlXG4gICAgICAgICAgICAgICAgICAgICAgICAsICdtZXRob2QucmVzcG9uc2UuaGVhZGVyLkFjY2Vzcy1Db250cm9sLUFsbG93LUhlYWRlcnMnOiB0cnVlXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgLCByZXNwb25zZU1vZGVsczoge1xuICAgICAgICAgICAgICAgICAgICAnYXBwbGljYXRpb24vanNvbic6ICdFbXB0eSdcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIF1cbiAgICAgICAgfSk7XG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogREVBTExPQ0FURSBcbiAgICAgICAgICogUmVzb3VyY2U6IC9kZWFsbG9jYXRlXG4gICAgICAgICAqIE1ldGhvZDogUE9TVFxuICAgICAgICAgKiBSZXF1ZXN0IGZvcm1hdDogeyAnVXNlcm5hbWUnIDogJzx0aGUgdXNlciBuYW1lPid9XG4gICAgICAgICAqL1xuICAgICAgICBsZXQgZGVhbGxvY2F0ZSA9IG5ldyBBUElHVFcuQ2ZuUmVzb3VyY2UodGhpcywgcHJvcHMuZ2V0QXBwUmVmTmFtZSgpICsgXCJBUEl2MWRlYWxsb2NhdGVcIiwge1xuICAgICAgICAgICAgcGFyZW50SWQ6IHYxLnJlc291cmNlSWRcbiAgICAgICAgICAgICwgcGF0aFBhcnQ6ICdkZWFsbG9jYXRlJ1xuICAgICAgICAgICAgLCByZXN0QXBpSWQ6IHRoaXMuYXBpLnJlc3RBcGlJZFxuICAgICAgICB9KTtcblxuICAgICAgICAvLyBQT1NUXG4gICAgICAgIGxldCBkZWFsbG9jYXRlUG9zdE1ldGhvZCA9IG5ldyBBUElHVFcuQ2ZuTWV0aG9kKHRoaXMsIHByb3BzLmdldEFwcFJlZk5hbWUoKSArIFwiQVBJdjFkZWFsbG9jYXRlUE9TVFwiLCB7XG4gICAgICAgICAgICAgIHJlc3RBcGlJZDogdGhpcy5hcGkucmVzdEFwaUlkXG4gICAgICAgICAgICAsIHJlc291cmNlSWQ6IGRlYWxsb2NhdGUucmVzb3VyY2VJZFxuICAgICAgICAgICAgLCBhdXRob3JpemF0aW9uVHlwZTogQVBJR1RXLkF1dGhvcml6YXRpb25UeXBlLkNvZ25pdG9cbiAgICAgICAgICAgICwgYXV0aG9yaXplcklkOiBhdXRob3JpemVyLmF1dGhvcml6ZXJJZFxuICAgICAgICAgICAgLCBodHRwTWV0aG9kOiAnUE9TVCdcbiAgICAgICAgICAgICwgaW50ZWdyYXRpb246IHtcbiAgICAgICAgICAgICAgICBpbnRlZ3JhdGlvbkh0dHBNZXRob2Q6ICdQT1NUJ1xuICAgICAgICAgICAgICAgICwgdHlwZTogJ0FXU19QUk9YWSdcbiAgICAgICAgICAgICAgICAsIGNvbnRlbnRIYW5kbGluZzogXCJDT05WRVJUX1RPX1RFWFRcIlxuICAgICAgICAgICAgICAgICwgdXJpOiAnYXJuOmF3czphcGlnYXRld2F5OicgKyBwcm9wcy5yZWdpb24gKyAnOmxhbWJkYTpwYXRoLzIwMTUtMDMtMzEvZnVuY3Rpb25zLycgKyBwcm9wcy5nZXRQYXJhbWV0ZXIoJ2xhbWJkYS5kZWFsbG9jYXRlJykgKyAnL2ludm9jYXRpb25zJ1xuICAgICAgICAgICAgICAgICwgY3JlZGVudGlhbHM6IGFwaXJvbGUucm9sZUFyblxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLCBtZXRob2RSZXNwb25zZXM6IFtcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIHN0YXR1c0NvZGU6ICcyMDAnXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgXVxuICAgICAgICB9KTtcblxuXG4gICAgICAgIC8vIE9QVElPTlNcbiAgICAgICAgbGV0IGRlYWxsb2NhdGVPcHRpb25zTWV0aG9kID0gbmV3IEFQSUdUVy5DZm5NZXRob2QodGhpcywgcHJvcHMuZ2V0QXBwUmVmTmFtZSgpICsgXCJBUEl2MWRlYWxsb2NhdGVPUFRJT05TXCIsIHtcbiAgICAgICAgICAgIHJlc3RBcGlJZDogdGhpcy5hcGkucmVzdEFwaUlkXG4gICAgICAgICAgICAsIHJlc291cmNlSWQ6IGRlYWxsb2NhdGUucmVzb3VyY2VJZFxuICAgICAgICAgICAgLCBhdXRob3JpemF0aW9uVHlwZTogQVBJR1RXLkF1dGhvcml6YXRpb25UeXBlLk5vbmVcbiAgICAgICAgICAgICwgaHR0cE1ldGhvZDogJ09QVElPTlMnXG4gICAgICAgICAgICAsIGludGVncmF0aW9uOiB7XG4gICAgICAgICAgICAgICAgcGFzc3Rocm91Z2hCZWhhdmlvcjogJ3doZW5fbm9fbWF0Y2gnXG4gICAgICAgICAgICAgICAgLCB0eXBlOiAnTU9DSydcbiAgICAgICAgICAgICAgICAsIHJlcXVlc3RUZW1wbGF0ZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgJ2FwcGxpY2F0aW9uL2pzb24nOiBge1xcXCJzdGF0dXNDb2RlXFxcIjogMjAwfWBcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLCBpbnRlZ3JhdGlvblJlc3BvbnNlczogW1xuICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzdGF0dXNDb2RlOiAnMjAwJ1xuICAgICAgICAgICAgICAgICAgICAgICAgLCByZXNwb25zZVBhcmFtZXRlcnM6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAnbWV0aG9kLnJlc3BvbnNlLmhlYWRlci5BY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4nOiBcIicqJ1wiXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLCAnbWV0aG9kLnJlc3BvbnNlLmhlYWRlci5BY2Nlc3MtQ29udHJvbC1BbGxvdy1NZXRob2RzJzogXCInKidcIlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICwgJ21ldGhvZC5yZXNwb25zZS5oZWFkZXIuQWNjZXNzLUNvbnRyb2wtQWxsb3ctSGVhZGVycyc6IFwiJ0NvbnRlbnQtVHlwZSxBdXRob3JpemF0aW9uLFgtQW16LURhdGUsWC1BcGktS2V5LFgtQW16LVNlY3VyaXR5LVRva2VuJ1wiXG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1dXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAsIG1ldGhvZFJlc3BvbnNlczogW1xuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgc3RhdHVzQ29kZTogJzIwMCdcbiAgICAgICAgICAgICAgICAgICAgLCByZXNwb25zZVBhcmFtZXRlcnM6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICdtZXRob2QucmVzcG9uc2UuaGVhZGVyLkFjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpbic6IHRydWVcbiAgICAgICAgICAgICAgICAgICAgICAgICwgJ21ldGhvZC5yZXNwb25zZS5oZWFkZXIuQWNjZXNzLUNvbnRyb2wtQWxsb3ctTWV0aG9kcyc6IHRydWVcbiAgICAgICAgICAgICAgICAgICAgICAgICwgJ21ldGhvZC5yZXNwb25zZS5oZWFkZXIuQWNjZXNzLUNvbnRyb2wtQWxsb3ctSGVhZGVycyc6IHRydWVcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAsIHJlc3BvbnNlTW9kZWxzOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAnYXBwbGljYXRpb24vanNvbic6ICdFbXB0eSdcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIF1cbiAgICAgICAgfSk7XG5cblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBTQ09SRUJPQVJEIFxuICAgICAgICAgKiBSZXNvdXJjZTogL2RlYWxsb2NhdGVcbiAgICAgICAgICogTWV0aG9kOiBHRVRcbiAgICAgICAgICogUmVxdWVzdCBmb3JtYXQ6IFxuICAgICAgICAgKiAgICAgIHF1ZXJ5c3RyaW5nOiBzZXNzaW9uSWQ9PDxTZXNzaW9uIElkPj5cbiAgICAgICAgICogUmVzcG9uc2UgZm9ybWF0OlxuICAgICAgICAgKiB7XG4gICAgICAgICAgICAgICAgXCJTY29yZWJvYXJkXCI6IFtcbiAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIlNjb3JlXCI6IDcwNTUsXG4gICAgICAgICAgICAgICAgICAgIFwiTGV2ZWxcIjogMTMsXG4gICAgICAgICAgICAgICAgICAgIFwiU2hvdHNcIjogOTQyLFxuICAgICAgICAgICAgICAgICAgICBcIk5pY2tuYW1lXCI6IFwiUFNDXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiTGl2ZXNcIjogM1xuICAgICAgICAgICAgICAgICAgICB9Li4sXG4gICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgfVxuICAgICAgICAgKi9cbiAgICAgICAgbGV0IHNjb3JlYm9hcmQgPSBuZXcgQVBJR1RXLkNmblJlc291cmNlKHRoaXMsIHByb3BzLmdldEFwcFJlZk5hbWUoKSArIFwiQVBJdjFzY29yZWJvYXJkXCIsIHtcbiAgICAgICAgICAgIHBhcmVudElkOiB2MS5yZXNvdXJjZUlkXG4gICAgICAgICAgICAsIHBhdGhQYXJ0OiAnc2NvcmVib2FyZCdcbiAgICAgICAgICAgICwgcmVzdEFwaUlkOiB0aGlzLmFwaS5yZXN0QXBpSWRcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gUE9TVFxuICAgICAgICBsZXQgc2NvcmVib2FyZFBvc3RNZXRob2QgPSBuZXcgQVBJR1RXLkNmbk1ldGhvZCh0aGlzLCBwcm9wcy5nZXRBcHBSZWZOYW1lKCkgKyBcIkFQSXYxc2NvcmVib2FyZFBPU1RcIiwge1xuICAgICAgICAgICAgcmVzdEFwaUlkOiB0aGlzLmFwaS5yZXN0QXBpSWRcbiAgICAgICAgICAgICwgcmVzb3VyY2VJZDogc2NvcmVib2FyZC5yZXNvdXJjZUlkXG4gICAgICAgICAgICAsIGF1dGhvcml6YXRpb25UeXBlOiBBUElHVFcuQXV0aG9yaXphdGlvblR5cGUuQ29nbml0b1xuICAgICAgICAgICAgLCBhdXRob3JpemVySWQ6IGF1dGhvcml6ZXIuYXV0aG9yaXplcklkXG4gICAgICAgICAgICAsIGh0dHBNZXRob2Q6ICdHRVQnXG4gICAgICAgICAgICAsIHJlcXVlc3RQYXJhbWV0ZXJzOiB7XG4gICAgICAgICAgICAgICAgJ21ldGhvZC5yZXF1ZXN0LnF1ZXJ5c3RyaW5nLnNlc3Npb25JZCc6IHRydWVcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgICwgaW50ZWdyYXRpb246IHtcbiAgICAgICAgICAgICAgICBpbnRlZ3JhdGlvbkh0dHBNZXRob2Q6ICdQT1NUJ1xuICAgICAgICAgICAgICAgICwgdHlwZTogJ0FXUydcbiAgICAgICAgICAgICAgICAsIHVyaTogJ2Fybjphd3M6YXBpZ2F0ZXdheTonICsgcHJvcHMucmVnaW9uICsgJzpkeW5hbW9kYjphY3Rpb24vR2V0SXRlbSdcbiAgICAgICAgICAgICAgICAsIGNyZWRlbnRpYWxzOiBhcGlyb2xlLnJvbGVBcm5cbiAgICAgICAgICAgICAgICAsIHJlcXVlc3RQYXJhbWV0ZXJzOiB7XG4gICAgICAgICAgICAgICAgICAgICdpbnRlZ3JhdGlvbi5yZXF1ZXN0LnF1ZXJ5c3RyaW5nLnNlc3Npb25JZCc6ICdtZXRob2QucmVxdWVzdC5xdWVyeXN0cmluZy5zZXNzaW9uSWQnXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICwgcGFzc3Rocm91Z2hCZWhhdmlvcjogJ1dIRU5fTk9fVEVNUExBVEVTJ1xuICAgICAgICAgICAgICAgICwgcmVxdWVzdFRlbXBsYXRlczoge1xuICAgICAgICAgICAgICAgICAgICAnYXBwbGljYXRpb24vanNvbic6IGB7XG4gICAgICAgICAgICAgICAgICAgICAgICBcIlRhYmxlTmFtZVwiIDogXCJgKyAoPFRhYmxlPnByb3BzLmdldFBhcmFtZXRlcigndGFibGUuc2Vzc2lvbnRvcHgnKSkudGFibGVOYW1lICsgYFwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgXCJLZXlcIiA6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBcIlNlc3Npb25JZFwiIDoge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcIlNcIiA6IFwiJGlucHV0LnBhcmFtcygnc2Vzc2lvbklkJylcIlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfWBcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLCBpbnRlZ3JhdGlvblJlc3BvbnNlczogW1xuICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzdGF0dXNDb2RlOiAnMjAwJ1xuICAgICAgICAgICAgICAgICAgICAgICAgLCByZXNwb25zZVBhcmFtZXRlcnM6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAnbWV0aG9kLnJlc3BvbnNlLmhlYWRlci5BY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4nOiBcIicqJ1wiXG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAsIHJlc3BvbnNlVGVtcGxhdGVzOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gVGhpcyBpcyBnb2luZyB0byBiZSB0cmlja3kgdG8gYmUgZ2VuZXJhbGl6ZWRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAnYXBwbGljYXRpb24vanNvbic6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGAjc2V0KCRzY29yZWJvYXJkID0gJGlucHV0LnBhdGgoJyQuSXRlbS5Ub3BYLkwnKSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiU2NvcmVib2FyZFwiIDogW1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI2ZvcmVhY2goJGdhbWVyU2NvcmUgaW4gJHNjb3JlYm9hcmQpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiU2NvcmVcIiA6ICRnYW1lclNjb3JlLk0uU2NvcmUuTiAsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcIkxldmVsXCIgOiAkZ2FtZXJTY29yZS5NLkxldmVsLk4gLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJTaG90c1wiIDogJGdhbWVyU2NvcmUuTS5TaG90cy5OICxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiTmlja25hbWVcIiA6IFwiJGdhbWVyU2NvcmUuTS5OaWNrbmFtZS5TXCIgLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJMaXZlc1wiIDogJGdhbWVyU2NvcmUuTS5MaXZlcy5OXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0jaWYoJGZvcmVhY2guaGFzTmV4dCksI2VuZFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAjZW5kXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9YFxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLCBtZXRob2RSZXNwb25zZXM6IFtcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIHN0YXR1c0NvZGU6ICcyMDAnXG4gICAgICAgICAgICAgICAgICAgICwgcmVzcG9uc2VQYXJhbWV0ZXJzOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAnbWV0aG9kLnJlc3BvbnNlLmhlYWRlci5BY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4nOiB0cnVlXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgLCByZXNwb25zZU1vZGVsczoge1xuICAgICAgICAgICAgICAgICAgICAgICAgJ2FwcGxpY2F0aW9uL2pzb24nOiBhcGlNb2RlbFNjb3JlYm9hcmRSZXNwb25zZS5yZWZcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIF1cbiAgICAgICAgfSk7XG5cblxuICAgICAgICAvLyBPUFRJT05TXG4gICAgICAgIGxldCBzY29yZWJvYXJkT3B0aW9uc01ldGhvZCA9IG5ldyBBUElHVFcuQ2ZuTWV0aG9kKHRoaXMsIHByb3BzLmdldEFwcFJlZk5hbWUoKSArIFwiQVBJdjFzY29yZWJvYXJkT1BUSU9OU1wiLCB7XG4gICAgICAgICAgICByZXN0QXBpSWQ6IHRoaXMuYXBpLnJlc3RBcGlJZFxuICAgICAgICAgICAgLCByZXNvdXJjZUlkOiBzY29yZWJvYXJkLnJlc291cmNlSWRcbiAgICAgICAgICAgICwgYXV0aG9yaXphdGlvblR5cGU6IEFQSUdUVy5BdXRob3JpemF0aW9uVHlwZS5Ob25lXG4gICAgICAgICAgICAsIGh0dHBNZXRob2Q6ICdPUFRJT05TJ1xuICAgICAgICAgICAgLCBpbnRlZ3JhdGlvbjoge1xuICAgICAgICAgICAgICAgIHBhc3N0aHJvdWdoQmVoYXZpb3I6ICd3aGVuX25vX21hdGNoJ1xuICAgICAgICAgICAgICAgICwgdHlwZTogJ01PQ0snXG4gICAgICAgICAgICAgICAgLCByZXF1ZXN0VGVtcGxhdGVzOiB7XG4gICAgICAgICAgICAgICAgICAgICdhcHBsaWNhdGlvbi9qc29uJzogYHtcXFwic3RhdHVzQ29kZVxcXCI6IDIwMH1gXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICwgaW50ZWdyYXRpb25SZXNwb25zZXM6IFtcbiAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgc3RhdHVzQ29kZTogJzIwMCdcbiAgICAgICAgICAgICAgICAgICAgICAgICwgcmVzcG9uc2VQYXJhbWV0ZXJzOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJ21ldGhvZC5yZXNwb25zZS5oZWFkZXIuQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luJzogXCInKidcIlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICwgJ21ldGhvZC5yZXNwb25zZS5oZWFkZXIuQWNjZXNzLUNvbnRyb2wtQWxsb3ctTWV0aG9kcyc6IFwiJyonXCJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAsICdtZXRob2QucmVzcG9uc2UuaGVhZGVyLkFjY2Vzcy1Db250cm9sLUFsbG93LUhlYWRlcnMnOiBcIidDb250ZW50LVR5cGUsQXV0aG9yaXphdGlvbixYLUFtei1EYXRlLFgtQXBpLUtleSxYLUFtei1TZWN1cml0eS1Ub2tlbidcIlxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLCBtZXRob2RSZXNwb25zZXM6IFtcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIHN0YXR1c0NvZGU6ICcyMDAnXG4gICAgICAgICAgICAgICAgICAgICwgcmVzcG9uc2VQYXJhbWV0ZXJzOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAnbWV0aG9kLnJlc3BvbnNlLmhlYWRlci5BY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4nOiB0cnVlXG4gICAgICAgICAgICAgICAgICAgICAgICAsICdtZXRob2QucmVzcG9uc2UuaGVhZGVyLkFjY2Vzcy1Db250cm9sLUFsbG93LU1ldGhvZHMnOiB0cnVlXG4gICAgICAgICAgICAgICAgICAgICAgICAsICdtZXRob2QucmVzcG9uc2UuaGVhZGVyLkFjY2Vzcy1Db250cm9sLUFsbG93LUhlYWRlcnMnOiB0cnVlXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgLCByZXNwb25zZU1vZGVsczoge1xuICAgICAgICAgICAgICAgICAgICAgICAgJ2FwcGxpY2F0aW9uL2pzb24nOiAnRW1wdHknXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICBdXG4gICAgICAgIH0pO1xuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFVQREFURVNUQVRVU1xuICAgICAgICAgKiBSZXNvdXJjZTogL3VwZGF0ZXN0YXR1c1xuICAgICAgICAgKiBNZXRob2Q6IFBPU1RcbiAgICAgICAgICogUmVxdWVzdCBmb3JtYXQ6XG4gICAgICAgICAqICBib2R5IDoge1xuICAgICAgICAgKiAgICAgICBcIkxldmVsXCI6IDEsXG4gICAgICAgICAqICAgICAgIFwiTGl2ZXNcIjogMyxcbiAgICAgICAgICogICAgICAgXCJOaWNrbmFtZVwiOiBcImNoaWNvYmVudG9cIixcbiAgICAgICAgICogICAgICAgXCJTY29yZVwiOiAyNTEsXG4gICAgICAgICAqICAgICAgIFwiU2Vzc2lvbklkXCI6IFwiWDE4MTAwMVQyMTU4MDhcIixcbiAgICAgICAgICogICAgICAgXCJTaG90c1wiOiA0LFxuICAgICAgICAgKiAgICAgICBcIlRpbWVzdGFtcFwiOiBcIjIwMTgtMTAtMTBUMjM6NTc6MjYuMTM3WlwiXG4gICAgICAgICAqICAgICAgIH1cbiAgICAgICAgICovXG4gICAgICAgIGxldCB1cGRhdGVTdGF0dXMgPSBuZXcgQVBJR1RXLkNmblJlc291cmNlKHRoaXMsIHByb3BzLmdldEFwcFJlZk5hbWUoKSArIFwiQVBJdjF1cGRhdGVzdGF0dXNcIiwge1xuICAgICAgICAgICAgcGFyZW50SWQ6IHYxLnJlc291cmNlSWRcbiAgICAgICAgICAgICwgcGF0aFBhcnQ6ICd1cGRhdGVzdGF0dXMnXG4gICAgICAgICAgICAsIHJlc3RBcGlJZDogdGhpcy5hcGkucmVzdEFwaUlkXG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIFBPU1RcbiAgICAgICAgbGV0IHVwZGF0ZXN0YXR1c1Bvc3RNZXRob2QgPSBuZXcgQVBJR1RXLkNmbk1ldGhvZCh0aGlzLCBwcm9wcy5nZXRBcHBSZWZOYW1lKCkgKyBcIkFQSXYxdXBkYXRlc3RhdHVzUE9TVFwiLCB7XG4gICAgICAgICAgICByZXN0QXBpSWQ6IHRoaXMuYXBpLnJlc3RBcGlJZFxuICAgICAgICAgICAgLCByZXNvdXJjZUlkOiB1cGRhdGVTdGF0dXMucmVzb3VyY2VJZFxuICAgICAgICAgICAgLCBhdXRob3JpemF0aW9uVHlwZTogQVBJR1RXLkF1dGhvcml6YXRpb25UeXBlLkNvZ25pdG9cbiAgICAgICAgICAgICwgYXV0aG9yaXplcklkOiBhdXRob3JpemVyLmF1dGhvcml6ZXJJZFxuICAgICAgICAgICAgLCBodHRwTWV0aG9kOiAnUE9TVCdcbiAgICAgICAgICAgICwgcmVxdWVzdFBhcmFtZXRlcnM6IHtcbiAgICAgICAgICAgICAgICAnbWV0aG9kLnJlcXVlc3QuaGVhZGVyLkF1dGhlbnRpY2F0aW9uJzogdHJ1ZVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLCBpbnRlZ3JhdGlvbjoge1xuICAgICAgICAgICAgICAgIGludGVncmF0aW9uSHR0cE1ldGhvZDogJ1BPU1QnXG4gICAgICAgICAgICAgICAgLCB0eXBlOiAnQVdTJ1xuICAgICAgICAgICAgICAgICwgdXJpOiAnYXJuOmF3czphcGlnYXRld2F5OicgKyBwcm9wcy5yZWdpb24gKyAnOmtpbmVzaXM6YWN0aW9uL1B1dFJlY29yZCdcbiAgICAgICAgICAgICAgICAsIGNyZWRlbnRpYWxzOiBhcGlyb2xlLnJvbGVBcm5cbiAgICAgICAgICAgICAgICAsIHBhc3N0aHJvdWdoQmVoYXZpb3I6ICdXSEVOX05PX1RFTVBMQVRFUydcbiAgICAgICAgICAgICAgICAsIHJlcXVlc3RUZW1wbGF0ZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgJ2FwcGxpY2F0aW9uL2pzb24nOlxuICAgICAgICAgICAgICAgICAgICAgICAgYCNzZXQoJGlucHV0Um9vdCA9ICRpbnB1dC5wYXRoKCckJykpXG4gICAgICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJEYXRhXCIgOiBcIiR1dGlsLmJhc2U2NEVuY29kZShcIiRpbnB1dC5qc29uKCckJylcIilcIixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBcIlBhcnRpdGlvbktleVwiIDogJGlucHV0Lmpzb24oJyQuU2Vzc2lvbklkJyksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJTdHJlYW1OYW1lXCIgOiBcImArIHRoaXMua2luZXNpc1N0cmVhbXMuc3RyZWFtTmFtZSArIGBcIlxuICAgICAgICAgICAgICAgICAgICAgICAgfWBcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLCBpbnRlZ3JhdGlvblJlc3BvbnNlczogW1xuICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzdGF0dXNDb2RlOiAnMjAwJ1xuICAgICAgICAgICAgICAgICAgICAgICAgLCByZXNwb25zZVBhcmFtZXRlcnM6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAnbWV0aG9kLnJlc3BvbnNlLmhlYWRlci5BY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4nOiBcIicqJ1wiXG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1dXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAsIG1ldGhvZFJlc3BvbnNlczogW1xuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgc3RhdHVzQ29kZTogJzIwMCdcbiAgICAgICAgICAgICAgICAgICAgLCByZXNwb25zZVBhcmFtZXRlcnM6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICdtZXRob2QucmVzcG9uc2UuaGVhZGVyLkFjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpbic6IHRydWVcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICwgcmVzcG9uc2VNb2RlbHM6IHtcbiAgICAgICAgICAgICAgICAgICAgJ2FwcGxpY2F0aW9uL2pzb24nOiAnRW1wdHknXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIF1cbiAgICAgICAgfSk7XG5cblxuICAgICAgICAvLyBPUFRJT05TXG4gICAgICAgIGxldCB1cGRhdGVzdGF0dXNPcHRpb25zTWV0aG9kID0gbmV3IEFQSUdUVy5DZm5NZXRob2QodGhpcywgcHJvcHMuZ2V0QXBwUmVmTmFtZSgpICsgXCJBUEl2MXVwZGF0ZVN0YXR1c09QVElPTlNcIiwge1xuICAgICAgICAgICAgcmVzdEFwaUlkOiB0aGlzLmFwaS5yZXN0QXBpSWRcbiAgICAgICAgICAgICwgcmVzb3VyY2VJZDogdXBkYXRlU3RhdHVzLnJlc291cmNlSWRcbiAgICAgICAgICAgICwgYXV0aG9yaXphdGlvblR5cGU6IEFQSUdUVy5BdXRob3JpemF0aW9uVHlwZS5Ob25lXG4gICAgICAgICAgICAsIGh0dHBNZXRob2Q6ICdPUFRJT05TJ1xuICAgICAgICAgICAgLCBpbnRlZ3JhdGlvbjoge1xuICAgICAgICAgICAgICAgIHBhc3N0aHJvdWdoQmVoYXZpb3I6ICd3aGVuX25vX21hdGNoJ1xuICAgICAgICAgICAgICAgICwgdHlwZTogJ01PQ0snXG4gICAgICAgICAgICAgICAgLCByZXF1ZXN0VGVtcGxhdGVzOiB7XG4gICAgICAgICAgICAgICAgICAgICdhcHBsaWNhdGlvbi9qc29uJzogYHtcXFwic3RhdHVzQ29kZVxcXCI6IDIwMH1gXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICwgaW50ZWdyYXRpb25SZXNwb25zZXM6IFtcbiAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgc3RhdHVzQ29kZTogJzIwMCdcbiAgICAgICAgICAgICAgICAgICAgICAgICwgcmVzcG9uc2VQYXJhbWV0ZXJzOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJ21ldGhvZC5yZXNwb25zZS5oZWFkZXIuQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luJzogXCInKidcIlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICwgJ21ldGhvZC5yZXNwb25zZS5oZWFkZXIuQWNjZXNzLUNvbnRyb2wtQWxsb3ctTWV0aG9kcyc6IFwiJyonXCJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAsICdtZXRob2QucmVzcG9uc2UuaGVhZGVyLkFjY2Vzcy1Db250cm9sLUFsbG93LUhlYWRlcnMnOiBcIidDb250ZW50LVR5cGUsQXV0aG9yaXphdGlvbixYLUFtei1EYXRlLFgtQXBpLUtleSxYLUFtei1TZWN1cml0eS1Ub2tlbidcIlxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLCBtZXRob2RSZXNwb25zZXM6IFtcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIHN0YXR1c0NvZGU6ICcyMDAnXG4gICAgICAgICAgICAgICAgICAgICwgcmVzcG9uc2VQYXJhbWV0ZXJzOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAnbWV0aG9kLnJlc3BvbnNlLmhlYWRlci5BY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4nOiB0cnVlXG4gICAgICAgICAgICAgICAgICAgICAgICAsICdtZXRob2QucmVzcG9uc2UuaGVhZGVyLkFjY2Vzcy1Db250cm9sLUFsbG93LU1ldGhvZHMnOiB0cnVlXG4gICAgICAgICAgICAgICAgICAgICAgICAsICdtZXRob2QucmVzcG9uc2UuaGVhZGVyLkFjY2Vzcy1Db250cm9sLUFsbG93LUhlYWRlcnMnOiB0cnVlXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAsIHJlc3BvbnNlTW9kZWxzOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAnYXBwbGljYXRpb24vanNvbic6ICdFbXB0eSdcbiAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgXVxuICAgICAgICB9KTtcblxuXG4gICAgICAgIGxldCBkZXBsb3ltZW50ID0gbmV3IEFQSUdUVy5DZm5EZXBsb3ltZW50KHRoaXMsIHByb3BzLmdldEFwcFJlZk5hbWUoKSArIFwiQVBJRGVwbG95bWVudFwiLCB7XG4gICAgICAgICAgICByZXN0QXBpSWQ6IHRoaXMuYXBpLnJlc3RBcGlJZFxuICAgICAgICAgICAgLCBzdGFnZU5hbWU6ICdwcm9kJ1xuICAgICAgICAgICAgLCBkZXNjcmlwdGlvbjogJ1Byb2R1Y3Rpb24gZGVwbG95bWVudCdcbiAgICAgICAgfSk7XG4gICAgICAgIGRlcGxveW1lbnQuYWRkRGVwZW5kc09uKHNlc3Npb25HZXRNZXRob2QpO1xuICAgICAgICBkZXBsb3ltZW50LmFkZERlcGVuZHNPbihzZXNzaW9uT3B0aW9uc01ldGhvZCk7XG4gICAgICAgIGRlcGxveW1lbnQuYWRkRGVwZW5kc09uKGNvbmZpZ0dldE1ldGhvZCk7XG4gICAgICAgIGRlcGxveW1lbnQuYWRkRGVwZW5kc09uKGNvbmZpZ09wdGlvbnNNZXRob2QpO1xuICAgICAgICBkZXBsb3ltZW50LmFkZERlcGVuZHNPbihhbGxvY2F0ZVBvc3RNZXRob2QpO1xuICAgICAgICBkZXBsb3ltZW50LmFkZERlcGVuZHNPbihhbGxvY2F0ZU9wdGlvbnNNZXRob2QpO1xuICAgICAgICBkZXBsb3ltZW50LmFkZERlcGVuZHNPbihkZWFsbG9jYXRlUG9zdE1ldGhvZCk7XG4gICAgICAgIGRlcGxveW1lbnQuYWRkRGVwZW5kc09uKGRlYWxsb2NhdGVPcHRpb25zTWV0aG9kKTtcbiAgICAgICAgZGVwbG95bWVudC5hZGREZXBlbmRzT24oc2NvcmVib2FyZFBvc3RNZXRob2QpO1xuICAgICAgICBkZXBsb3ltZW50LmFkZERlcGVuZHNPbihzY29yZWJvYXJkT3B0aW9uc01ldGhvZCk7XG4gICAgICAgIGRlcGxveW1lbnQuYWRkRGVwZW5kc09uKHVwZGF0ZXN0YXR1c1Bvc3RNZXRob2QpO1xuICAgICAgICBkZXBsb3ltZW50LmFkZERlcGVuZHNPbih1cGRhdGVzdGF0dXNPcHRpb25zTWV0aG9kKTtcbiAgICB9XG5cblxuICAgIHVwZGF0ZVVzZXJzUm9sZXMocHJvcHM6IElQYXJhbWV0ZXJBd2FyZVByb3BzKSB7XG5cbiAgICAgICAgbGV0IGJhc2VBcm4gPSAnYXJuOmF3czphcGlnYXRld2F5OicgKyBwcm9wcy5yZWdpb24gKyAnOicrcHJvcHMuYWNjb3VudElkKyc6JyArIHRoaXMuYXBpLnJlc3RBcGlJZCArICcvcHJvZC8qLyc7XG4gICAgICAgIGxldCBiYXNlRXhlY0FybiA9ICdhcm46YXdzOmV4ZWN1dGUtYXBpOicgKyBwcm9wcy5yZWdpb24gKyAnOicrcHJvcHMuYWNjb3VudElkKyc6JyArIHRoaXMuYXBpLnJlc3RBcGlJZCArICcvcHJvZC8nO1xuICAgICAgICBsZXQgcGxheWVyUm9sZSA9ICg8SUFNLlJvbGU+cHJvcHMuZ2V0UGFyYW1ldGVyKCdzZWN1cml0eS5wbGF5ZXJzcm9sZScpKTtcblxuICAgICAgICBwbGF5ZXJSb2xlLmFkZFRvUG9saWN5KFxuICAgICAgICAgICAgbmV3IElBTS5Qb2xpY3lTdGF0ZW1lbnQoKVxuICAgICAgICAgICAgICAgIC5kZXNjcmliZSgnQVBJR2F0ZXdheUdFVFBlcm1pc3Npb25zJylcbiAgICAgICAgICAgICAgICAuYWxsb3coKVxuICAgICAgICAgICAgICAgIC5hZGRBY3Rpb24oJ2FwaWdhdGV3YXk6R0VUJylcbiAgICAgICAgICAgICAgICAuYWRkUmVzb3VyY2VzKFxuICAgICAgICAgICAgICAgICAgICBiYXNlQXJuICsgJ2NvbmZpZycsXG4gICAgICAgICAgICAgICAgICAgIGJhc2VBcm4gKyAnc2Vzc2lvbicsXG4gICAgICAgICAgICAgICAgICAgIGJhc2VBcm4gKyAnc2NvcmVib2FyZCdcbiAgICAgICAgICAgICAgICApXG4gICAgICAgICk7XG4gICAgICAgIHBsYXllclJvbGUuYWRkVG9Qb2xpY3koXG4gICAgICAgICAgICBuZXcgSUFNLlBvbGljeVN0YXRlbWVudCgpXG4gICAgICAgICAgICAgICAgLmRlc2NyaWJlKCdBUElHYXRld2F5RVhFQ0dFVFBlcm1pc3Npb25zJylcbiAgICAgICAgICAgICAgICAuYWxsb3coKVxuICAgICAgICAgICAgICAgIC5hZGRBY3Rpb24oJ2V4ZWN1dGUtYXBpOkludm9rZScpXG4gICAgICAgICAgICAgICAgLmFkZFJlc291cmNlcyhcbiAgICAgICAgICAgICAgICAgICAgYmFzZUV4ZWNBcm4gKyAnR0VUL2NvbmZpZycsXG4gICAgICAgICAgICAgICAgICAgIGJhc2VFeGVjQXJuICsgJ0dFVC9zZXNzaW9uJyxcbiAgICAgICAgICAgICAgICAgICAgYmFzZUV4ZWNBcm4gKyAnR0VUL3Njb3JlYm9hcmQnXG4gICAgICAgICAgICAgICAgKVxuICAgICAgICApO1xuICAgICAgICBwbGF5ZXJSb2xlLmFkZFRvUG9saWN5KFxuICAgICAgICAgICAgbmV3IElBTS5Qb2xpY3lTdGF0ZW1lbnQoKVxuICAgICAgICAgICAgICAgIC5kZXNjcmliZSgnQVBJR2F0ZXdheVBPU1RQZXJtaXNzaW9ucycpXG4gICAgICAgICAgICAgICAgLmFsbG93KClcbiAgICAgICAgICAgICAgICAuYWRkQWN0aW9uKCdhcGlnYXRld2F5OlBPU1QnKVxuICAgICAgICAgICAgICAgIC5hZGRSZXNvdXJjZXMoXG4gICAgICAgICAgICAgICAgICAgIGJhc2VBcm4gKyAndXBkYXRlc3RhdHVzJyxcbiAgICAgICAgICAgICAgICAgICAgYmFzZUFybiArICdhbGxvY2F0ZScsXG4gICAgICAgICAgICAgICAgICAgIGJhc2VBcm4gKyAnZGVhbGxvY2F0ZSdcbiAgICAgICAgICAgICAgICApXG4gICAgICAgICk7XG4gICAgICAgIHBsYXllclJvbGUuYWRkVG9Qb2xpY3koXG4gICAgICAgICAgICBuZXcgSUFNLlBvbGljeVN0YXRlbWVudCgpXG4gICAgICAgICAgICAgICAgLmRlc2NyaWJlKCdBUElHYXRld2F5RVhFQ1BPU1RQZXJtaXNzaW9ucycpXG4gICAgICAgICAgICAgICAgLmFsbG93KClcbiAgICAgICAgICAgICAgICAuYWRkQWN0aW9uKCdleGVjdXRlLWFwaTpJbnZva2UnKVxuICAgICAgICAgICAgICAgIC5hZGRSZXNvdXJjZXMoXG4gICAgICAgICAgICAgICAgICAgIGJhc2VFeGVjQXJuICsgJ1BPU1QvdXBkYXRlc3RhdHVzJyxcbiAgICAgICAgICAgICAgICAgICAgYmFzZUV4ZWNBcm4gKyAnUE9TVC9hbGxvY2F0ZScsXG4gICAgICAgICAgICAgICAgICAgIGJhc2VFeGVjQXJuICsgJ1BPU1QvZGVhbGxvY2F0ZSdcbiAgICAgICAgICAgICAgICApXG4gICAgICAgICk7XG5cbiAgICAgICAgbGV0IG1hbmFnZXJSb2xlID0gKDxJQU0uUm9sZT4gcHJvcHMuZ2V0UGFyYW1ldGVyKCdzZWN1cml0eS5tYW5hZ2Vyc3JvbGUnKSk7XG4gICAgICAgIG1hbmFnZXJSb2xlLmFkZFRvUG9saWN5KFxuICAgICAgICAgICAgbmV3IElBTS5Qb2xpY3lTdGF0ZW1lbnQoKVxuICAgICAgICAgICAgICAgIC5kZXNjcmliZSgnRHluYW1vREJQZXJtaXNzaW9ucycpXG4gICAgICAgICAgICAgICAgLmFsbG93KClcbiAgICAgICAgICAgICAgICAuYWRkQWN0aW9ucyhcbiAgICAgICAgICAgICAgICAgICAgXCJkeW5hbW9kYjpCYXRjaEdldEl0ZW1cIixcbiAgICAgICAgICAgICAgICAgICAgXCJkeW5hbW9kYjpCYXRjaFdyaXRlSXRlbVwiLFxuICAgICAgICAgICAgICAgICAgICBcImR5bmFtb2RiOlB1dEl0ZW1cIixcbiAgICAgICAgICAgICAgICAgICAgXCJkeW5hbW9kYjpTY2FuXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiZHluYW1vZGI6UXVlcnlcIixcbiAgICAgICAgICAgICAgICAgICAgXCJkeW5hbW9kYjpHZXRJdGVtXCIgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgLmFkZFJlc291cmNlKFxuICAgICAgICAgICAgICAgICAgICBcImFybjphd3M6ZHluYW1vZGI6XCIrcHJvcHMucmVnaW9uK1wiOlwiK3Byb3BzLmFjY291bnRJZCtcIjp0YWJsZS9cIitwcm9wcy5nZXRBcHBSZWZOYW1lKCkrXCIqXCJcbiAgICAgICAgICAgICAgICApXG4gICAgICAgICk7XG4gICAgICAgIG1hbmFnZXJSb2xlLmFkZFRvUG9saWN5KFxuICAgICAgICAgICAgbmV3IElBTS5Qb2xpY3lTdGF0ZW1lbnQoKVxuICAgICAgICAgICAgICAgIC5kZXNjcmliZSgnU3lzdGVtc01hbmFnZXJQZXJtaXNzaW9ucycpXG4gICAgICAgICAgICAgICAgLmFkZEFjdGlvbnMoXG4gICAgICAgICAgICAgICAgICAgIFwic3NtOkdldFBhcmFtZXRlcnNcIixcbiAgICAgICAgICAgICAgICAgICAgXCJzc206R2V0UGFyYW1ldGVyXCIsXG4gICAgICAgICAgICAgICAgICAgIFwic3NtOkRlbGV0ZVBhcmFtZXRlcnNcIixcbiAgICAgICAgICAgICAgICAgICAgXCJzc206UHV0UGFyYW1ldGVyXCIsXG4gICAgICAgICAgICAgICAgICAgIFwic3NtOkRlbGV0ZVBhcmFtZXRlclwiXG4gICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICAgIC5hZGRSZXNvdXJjZShcbiAgICAgICAgICAgICAgICAgICAgXCJhcm46YXdzOnNzbTpcIitwcm9wcy5yZWdpb24rXCI6XCIrcHJvcHMuYWNjb3VudElkK1wiOnBhcmFtZXRlci9cIitwcm9wcy5nZXRBcHBSZWZOYW1lKCkudG9Mb3dlckNhc2UoKStcIi8qXCJcbiAgICAgICAgICAgICAgICApXG4gICAgICAgICk7XG4gICAgICAgIG1hbmFnZXJSb2xlLmFkZFRvUG9saWN5KFxuICAgICAgICAgICAgbmV3IElBTS5Qb2xpY3lTdGF0ZW1lbnQoKVxuICAgICAgICAgICAgLmRlc2NyaWJlKCdLaW5lc2lzUGVybWlzc2lvbnMnKVxuICAgICAgICAgICAgLmFkZEFjdGlvbnMoXG4gICAgICAgICAgICAgICAgXCJraW5lc2lzOkdldFNoYXJkSXRlcmF0b3JcIixcbiAgICAgICAgICAgICAgICBcImtpbmVzaXM6RGVzY3JpYmVTdHJlYW1cIixcbiAgICAgICAgICAgICAgICBcImtpbmVzaXM6R2V0UmVjb3Jkc1wiXG4gICAgICAgICAgICApXG4gICAgICAgICAgICAuYWRkUmVzb3VyY2UoXG4gICAgICAgICAgICAgICAgdGhpcy5raW5lc2lzU3RyZWFtcy5zdHJlYW1Bcm5cbiAgICAgICAgICAgIClcbiAgICAgICAgKTtcblxuICAgICAgICBtYW5hZ2VyUm9sZS5hZGRUb1BvbGljeShcbiAgICAgICAgICAgIG5ldyBJQU0uUG9saWN5U3RhdGVtZW50KClcbiAgICAgICAgICAgICAgICAuZGVzY3JpYmUoJ0FQSUdhdGV3YXlQZXJtaXNzaW9ucycpXG4gICAgICAgICAgICAgICAgLmFsbG93KClcbiAgICAgICAgICAgICAgICAuYWRkQWN0aW9uKCdhcGlnYXRld2F5OionKVxuICAgICAgICAgICAgICAgIC5hZGRSZXNvdXJjZXMoXG4gICAgICAgICAgICAgICAgICAgIGJhc2VBcm4gKyAnKicgXG4gICAgICAgICAgICAgICAgKVxuICAgICAgICApO1xuICAgIH1cblxufSJdfQ==