import { Construct } from '@aws-cdk/cdk';
import { ResourceAwareConstruct, IParameterAwareProps } from './../resourceawarestack'


import Cognito = require('@aws-cdk/aws-cognito');
import IAM = require('@aws-cdk/aws-iam');
import Lambda = require('@aws-cdk/aws-lambda');
import Cfn = require('@aws-cdk/aws-cloudformation');
const uuidv3 = require('uuid/v3');

const path = require('path');

const lambdasLocation = path.join(__dirname,'..','..','lambdas');
export interface SimpleUserPool {
    userPoolId : string,
    userPoolUrl : string,
    userPoolArn : string,
    userPoolProviderName : string,
    userPoolName : string
}

export class SecurityLayer extends ResourceAwareConstruct {

    userPool: SimpleUserPool;
    simpleUserPool : Cfn.CustomResource;
    identityPool: Cognito.CfnIdentityPool;
    userPoolClient: Cognito.CfnUserPoolClient;
    playersRole: IAM.Role;
    managersRole: IAM.Role;
    unauthenticatedRole: IAM.Role;
    postRegistrationTriggerFunction : Lambda.Function;
    postRegistrationTriggerFunctionRole : IAM.Role;
    

    getUserPoolId() {
        return this.userPool.userPoolId;
    }

    getUserPoolUrl() {
        let value = "cognito-idp." + (<string>this.properties.region) + ".amazonaws.com/" + this.userPool.userPoolId;
        return value;
    }


    getUserPoolArn() {
        return this.userPool.userPoolArn
    }

    getUserPoolClient() {
        return this.userPoolClient;
    }

    getUserPoolClientId() {
        return this.userPoolClient.userPoolClientId;
    }

    getIdentityPool() {
        return this.identityPool
    }

    getIdentityPoolId() {
        return this.identityPool.identityPoolId;
    }

    constructor(parent: Construct, name: string, props: IParameterAwareProps) {
        super(parent, name, props);
        this.userPool = {
            userPoolId : '',
            userPoolUrl : '',
            userPoolArn : '',
            userPoolProviderName : '',
            userPoolName : '',       
        }
        this.creatPostRegistrationLambdaTrigger();
        this.createUserPool();
        this.createUserPoolClientApp();
        this.createIdentityPool();
        this.createUserPoolGroups();
        this.configureIdentityPoolRoles();
    }

    private createUserPool() {

        const CDKNAMESPACE = 'aa596cee-451b-11e9-b210-d663bd873d93';
        let genFunctionId = this.properties.getAppRefName()+'SimpleUserPoolGenFn';
        const generatingFunction = new Lambda.SingletonFunction(this, genFunctionId, {
                 // To avoid collisions when running the on the same environment
                 // many times, we're using uuidv3 to stick to some 'aleatory' 
                 // uuid related to the genFunctionId
                 uuid : uuidv3(genFunctionId,CDKNAMESPACE)
                ,code : new Lambda.AssetCode(path.join(lambdasLocation,'simpleUserPool'))
               ,description : "Generates the UserPool using configuration not available on CDK"
               ,handler : 'index.handler'
               ,timeout : 300
               ,runtime : Lambda.Runtime.NodeJS610
           });
   
           generatingFunction.addToRolePolicy( new IAM.PolicyStatement()
               .allow()
               .addActions(
                   "cognito-idp:DeleteUserPool",
                   "cognito-idp:CreateUserPool",
                   "cognito-idp:UpdateUserPool",
                   "cognito-idp:CreateUserPoolDomain",
                   "cognito-idp:DeleteUserPoolDomain"
               )
               .addAllResources()
           );
   
           this.simpleUserPool = new Cfn.CustomResource(this, this.properties.getAppRefName()+'SimpleUserPoolCustomResource',{
                lambdaProvider : generatingFunction
               , properties : {
                   AppName : this.properties.getAppRefName(),
                   UserPoolName : this.properties.getAppRefName(),
                   PostConfirmationLambdaArn : this.postRegistrationTriggerFunction.functionArn
               }
           });
   
           this.userPool.userPoolId = this.simpleUserPool.getAtt('UserPoolId').toString();
           this.userPool.userPoolArn = this.simpleUserPool.getAtt('UserPoolArn').toString();
           this.userPool.userPoolProviderName = this.simpleUserPool.getAtt('UserPoolProviderName').toString();
           this.userPool.userPoolName = this.simpleUserPool.getAtt('UserPoolName').toString();

           // Gives permission for userpool to call the lambda trigger
           new Lambda.CfnPermission(this, this.properties.getAppRefName()+'UserPoolPerm', {
                action : 'lambda:invokeFunction'
               ,principal : 'cognito-idp.amazonaws.com'
               ,functionName : this.postRegistrationTriggerFunction.functionName
               ,sourceArn : this.userPool.userPoolArn
           })

        let policy = new IAM.Policy(this,this.properties.getAppRefName()+'TriggerFunctionPolicy',{
            policyName : 'AllowAddUserToGroup'
        });

        policy.addStatement(
            new IAM.PolicyStatement()
                .allow()
                .addResource(this.userPool.userPoolArn)
                .addAction('cognito-idp:AdminAddUserToGroup')
        )
        this.postRegistrationTriggerFunctionRole.attachInlinePolicy(policy);

        this.addResource('security.userpool', this.userPool);
    }


    private createUserPoolClientApp() {
        this.userPoolClient = new Cognito.CfnUserPoolClient(this, this.properties.getAppRefName() + 'App', {
            userPoolId: this.userPool.userPoolId,
            clientName: this.properties.getAppRefName() + 'Website',
            generateSecret: false,
            explicitAuthFlows : [ "USER_PASSWORD_AUTH" ]
        });
        this.addResource('security.userpoolclient', this.userPoolClient);
    }

    private createIdentityPool() {
        this.identityPool = new Cognito.CfnIdentityPool(this, this.properties.getAppRefName() + 'IdentityPool', {
            identityPoolName: this.properties.getAppRefName(),
            allowUnauthenticatedIdentities: false,
            cognitoIdentityProviders: [
                {
                    clientId: this.userPoolClient.userPoolClientId,
                    providerName: this.userPool.userPoolProviderName,
                    serverSideTokenCheck: false
                }
            ]
        })
        this.identityPool.addDependsOn(this.simpleUserPool);
        this.addResource('security.identitypool', this.identityPool);
    }

    private createUserPoolGroups() {
        // PLAYERS
        this.playersRole = new IAM.Role(this, this.properties.getAppRefName() + 'PlayersRole', {
            roleName : this.properties.getAppRefName() + 'PlayersRole',
            assumedBy: new IAM.FederatedPrincipal('cognito-identity.amazonaws.com', {
                "StringEquals": { "cognito-identity.amazonaws.com:aud": this.identityPool.identityPoolId },
                "ForAnyValue:StringLike": { "cognito-identity.amazonaws.com:amr": "authenticated" }
            },"sts:AssumeRoleWithWebIdentity")
        });
        this.playersRole.addToPolicy(new IAM.PolicyStatement()
            .allow()
            .addAction("mobileanalytics:PutEvents")
            .addAction("cognito-sync:*")
            .addActions("cognito-identity:*")
            .addAllResources()
        );
        this.addResource('security.playersrole',this.playersRole);

        new Cognito.CfnUserPoolGroup(this, this.properties.getAppRefName() + 'Players', {
            groupName: 'Players',
            description: 'Players of the game.',
            precedence: 9999,
            roleArn: this.playersRole.roleArn,
            userPoolId: this.userPool.userPoolId
        });

        // MANAGERS
        this.managersRole = new IAM.Role(this, this.properties.getAppRefName() + 'ManagersRole', {
            roleName : this.properties.getAppRefName() + 'ManagersRole',
            assumedBy: new IAM.FederatedPrincipal('cognito-identity.amazonaws.com', {
                "StringEquals": { "cognito-identity.amazonaws.com:aud": this.identityPool.identityPoolId },
                "ForAnyValue:StringLike": { "cognito-identity.amazonaws.com:amr": "authenticated" }
            },"sts:AssumeRoleWithWebIdentity")
        });
        this.managersRole.attachManagedPolicy('arn:aws:iam::aws:policy/AmazonCognitoPowerUser');
        this.managersRole.addToPolicy(new IAM.PolicyStatement()
            .allow()
            .addAction("mobileanalytics:PutEvents")
            .addAction("cognito-sync:*")
            .addActions("cognito-identity:*")
            .addAllResources()
        );
        this.addResource('security.managersrole',this.managersRole);
        new Cognito.CfnUserPoolGroup(this, this.properties.getAppRefName() + 'Managers', {
            groupName: 'Managers',
            description: 'Managers of the game.',
            precedence: 0,
            roleArn: this.managersRole.roleArn,
            userPoolId: this.userPool.userPoolId
        });
    }

    private configureIdentityPoolRoles() {
        this.unauthenticatedRole = new IAM.Role(this, this.properties.getAppRefName() + 'UnauthRole', {
            roleName : this.properties.getAppRefName() + 'UnauthRole',
            assumedBy: new IAM.FederatedPrincipal('cognito-identity.amazonaws.com', {
                "StringEquals": { "cognito-identity.amazonaws.com:aud": this.identityPool.identityPoolId },
                "ForAnyValue:StringLike": { "cognito-identity.amazonaws.com:amr": "unauthenticated" }
            })
        });
        this.unauthenticatedRole.addToPolicy(new IAM.PolicyStatement()
            .allow()
            .addAction("mobileanalytics:PutEvents")
            .addAction("cognito-sync:*")
            .addActions("cognito-identity:*")
            .addAllResources()
        ); 
        

        new Cognito.CfnIdentityPoolRoleAttachment(this, this.properties.getAppRefName() + "IDPRoles",
        {
            identityPoolId : this.identityPool.identityPoolId
           ,roles : {
               authenticated : this.playersRole.roleArn,
               unauthenticated : this.unauthenticatedRole.roleArn
           }
           // TO-DO Identify with the team from CDK how to implement this
       /*    ,roleMappings : {
               type: "Rules",
               ambiguousRoleResolution: "Deny",
               rulesConfiguration: {
                   rules: [
                       {
                           claim: "cognito:preferred_role",
                           matchType: "Contains",
                           value: "Managers",
                           roleArn: this.managersRole
                       },
                       {
                           claim: "cognito:preferred_role",
                           matchType: "Contains",
                           value: "Players",
                           roleArn: this.playersRole
                       }
                   ]
               }
           }
           */
       });

    }

    private creatPostRegistrationLambdaTrigger() {

        this.postRegistrationTriggerFunctionRole = new IAM.Role(this, this.properties.getAppRefName() + 'PostRegistrationFn_Role', {
            roleName: this.properties.getAppRefName() + 'PostRegistrationFn_Role'
            , assumedBy: new IAM.ServicePrincipal('lambda.amazonaws.com')
            , managedPolicyArns: ['arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole']
        });
        
        this.postRegistrationTriggerFunction =
            new Lambda.Function(this, this.properties.getAppRefName() + 'PostRegistration', {
                runtime: Lambda.Runtime.NodeJS810,
                handler: 'index.handler',
                code: Lambda.Code.asset(path.join(lambdasLocation,'postRegistration'))
                , functionName: this.properties.getAppRefName() + 'PostRegistrationFn'
                , description: 'This function adds an user to the Players group after confirmation'
                , memorySize: 128
                , timeout: 60
                , role: this.postRegistrationTriggerFunctionRole 
            });
    }

}