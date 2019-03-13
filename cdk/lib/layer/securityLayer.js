"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const resourceawarestack_1 = require("./../resourceawarestack");
const Cognito = require("@aws-cdk/aws-cognito");
const IAM = require("@aws-cdk/aws-iam");
const Lambda = require("@aws-cdk/aws-lambda");
const Cfn = require("@aws-cdk/aws-cloudformation");
const uuidv3 = require('uuid/v3');
const path = require('path');
const lambdasLocation = path.join(__dirname, '..', '..', 'lambdas');
class SecurityLayer extends resourceawarestack_1.ResourceAwareConstruct {
    getUserPoolId() {
        return this.userPool.userPoolId;
    }
    getUserPoolUrl() {
        let value = "cognito-idp." + this.properties.region + ".amazonaws.com/" + this.userPool.userPoolId;
        return value;
    }
    getUserPoolArn() {
        return this.userPool.userPoolArn;
    }
    getUserPoolClient() {
        return this.userPoolClient;
    }
    getUserPoolClientId() {
        return this.userPoolClient.userPoolClientId;
    }
    getIdentityPool() {
        return this.identityPool;
    }
    getIdentityPoolId() {
        return this.identityPool.identityPoolId;
    }
    constructor(parent, name, props) {
        super(parent, name, props);
        this.userPool = {
            userPoolId: '',
            userPoolUrl: '',
            userPoolArn: '',
            userPoolProviderName: '',
            userPoolName: '',
        };
        this.creatPostRegistrationLambdaTrigger();
        this.createUserPool();
        this.createUserPoolClientApp();
        this.createIdentityPool();
        this.createUserPoolGroups();
        this.configureIdentityPoolRoles();
    }
    createUserPool() {
        const CDKNAMESPACE = 'aa596cee-451b-11e9-b210-d663bd873d93';
        let genFunctionId = this.properties.getAppRefName() + 'SimpleUserPoolGenFn';
        const generatingFunction = new Lambda.SingletonFunction(this, genFunctionId, {
            // To avoid having a UUID function generated at every run, we will use
            // uuidv3 to stick to some 'aleatory' uuid related to the genFunctionId
            uuid: uuidv3(genFunctionId, CDKNAMESPACE),
            code: new Lambda.AssetCode(path.join(lambdasLocation, 'simpleUserPool')),
            description: "Generates the UserPool using configuration not available on CDK",
            handler: 'index.handler',
            timeout: 300,
            runtime: Lambda.Runtime.NodeJS610
        });
        generatingFunction.addToRolePolicy(new IAM.PolicyStatement()
            .allow()
            .addActions("cognito-idp:DeleteUserPool", "cognito-idp:CreateUserPool", "cognito-idp:UpdateUserPool", "cognito-idp:CreateUserPoolDomain", "cognito-idp:DeleteUserPoolDomain")
            .addAllResources());
        this.simpleUserPool = new Cfn.CustomResource(this, this.properties.getAppRefName() + 'SimpleUserPoolCustomResource', {
            lambdaProvider: generatingFunction,
            properties: {
                AppName: this.properties.getAppRefName(),
                UserPoolName: this.properties.getAppRefName(),
                PostConfirmationLambdaArn: this.postRegistrationTriggerFunction.functionArn
            }
        });
        this.userPool.userPoolId = this.simpleUserPool.getAtt('UserPoolId').toString();
        this.userPool.userPoolArn = this.simpleUserPool.getAtt('UserPoolArn').toString();
        this.userPool.userPoolProviderName = this.simpleUserPool.getAtt('UserPoolProviderName').toString();
        this.userPool.userPoolName = this.simpleUserPool.getAtt('UserPoolName').toString();
        // Gives permission for userpool to call the lambda trigger
        new Lambda.CfnPermission(this, this.properties.getAppRefName() + 'UserPoolPerm', {
            action: 'lambda:invokeFunction',
            principal: 'cognito-idp.amazonaws.com',
            functionName: this.postRegistrationTriggerFunction.functionName,
            sourceArn: this.userPool.userPoolArn
        });
        let policy = new IAM.Policy(this, this.properties.getAppRefName() + 'TriggerFunctionPolicy', {
            policyName: 'AllowAddUserToGroup'
        });
        policy.addStatement(new IAM.PolicyStatement()
            .allow()
            .addResource(this.userPool.userPoolArn)
            .addAction('cognito-idp:AdminAddUserToGroup'));
        this.postRegistrationTriggerFunctionRole.attachInlinePolicy(policy);
        this.addResource('security.userpool', this.userPool);
    }
    createUserPoolClientApp() {
        this.userPoolClient = new Cognito.CfnUserPoolClient(this, this.properties.getAppRefName() + 'App', {
            userPoolId: this.userPool.userPoolId,
            clientName: this.properties.getAppRefName() + 'Website',
            generateSecret: false,
            explicitAuthFlows: ["USER_PASSWORD_AUTH"]
        });
        this.addResource('security.userpoolclient', this.userPoolClient);
    }
    createIdentityPool() {
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
        });
        this.identityPool.addDependsOn(this.simpleUserPool);
        this.addResource('security.identitypool', this.identityPool);
    }
    createUserPoolGroups() {
        // PLAYERS
        this.playersRole = new IAM.Role(this, this.properties.getAppRefName() + 'PlayersRole', {
            roleName: this.properties.getAppRefName() + 'PlayersRole',
            assumedBy: new IAM.FederatedPrincipal('cognito-identity.amazonaws.com', {
                "StringEquals": { "cognito-identity.amazonaws.com:aud": this.identityPool.identityPoolId },
                "ForAnyValue:StringLike": { "cognito-identity.amazonaws.com:amr": "authenticated" }
            }, "sts:AssumeRoleWithWebIdentity")
        });
        this.playersRole.addToPolicy(new IAM.PolicyStatement()
            .allow()
            .addAction("mobileanalytics:PutEvents")
            .addAction("cognito-sync:*")
            .addActions("cognito-identity:*")
            .addAllResources());
        this.addResource('security.playersrole', this.playersRole);
        new Cognito.CfnUserPoolGroup(this, this.properties.getAppRefName() + 'Players', {
            groupName: 'Players',
            description: 'Players of the game.',
            precedence: 9999,
            roleArn: this.playersRole.roleArn,
            userPoolId: this.userPool.userPoolId
        });
        // MANAGERS
        this.managersRole = new IAM.Role(this, this.properties.getAppRefName() + 'ManagersRole', {
            roleName: this.properties.getAppRefName() + 'ManagersRole',
            assumedBy: new IAM.FederatedPrincipal('cognito-identity.amazonaws.com', {
                "StringEquals": { "cognito-identity.amazonaws.com:aud": this.identityPool.identityPoolId },
                "ForAnyValue:StringLike": { "cognito-identity.amazonaws.com:amr": "authenticated" }
            }, "sts:AssumeRoleWithWebIdentity")
        });
        this.managersRole.attachManagedPolicy('arn:aws:iam::aws:policy/AmazonCognitoPowerUser');
        this.managersRole.addToPolicy(new IAM.PolicyStatement()
            .allow()
            .addAction("mobileanalytics:PutEvents")
            .addAction("cognito-sync:*")
            .addActions("cognito-identity:*")
            .addAllResources());
        this.addResource('security.managersrole', this.managersRole);
        new Cognito.CfnUserPoolGroup(this, this.properties.getAppRefName() + 'Managers', {
            groupName: 'Managers',
            description: 'Managers of the game.',
            precedence: 0,
            roleArn: this.managersRole.roleArn,
            userPoolId: this.userPool.userPoolId
        });
    }
    configureIdentityPoolRoles() {
        this.unauthenticatedRole = new IAM.Role(this, this.properties.getAppRefName() + 'UnauthRole', {
            roleName: this.properties.getAppRefName() + 'UnauthRole',
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
            .addAllResources());
        new Cognito.CfnIdentityPoolRoleAttachment(this, this.properties.getAppRefName() + "IDPRoles", {
            identityPoolId: this.identityPool.identityPoolId,
            roles: {
                authenticated: this.playersRole.roleArn,
                unauthenticated: this.unauthenticatedRole.roleArn
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
    creatPostRegistrationLambdaTrigger() {
        this.postRegistrationTriggerFunctionRole = new IAM.Role(this, this.properties.getAppRefName() + 'PostRegistrationFn_Role', {
            roleName: this.properties.getAppRefName() + 'PostRegistrationFn_Role',
            assumedBy: new IAM.ServicePrincipal('lambda.amazonaws.com'),
            managedPolicyArns: ['arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole']
        });
        this.postRegistrationTriggerFunction =
            new Lambda.Function(this, this.properties.getAppRefName() + 'PostRegistration', {
                runtime: Lambda.Runtime.NodeJS810,
                handler: 'index.handler',
                code: Lambda.Code.asset(path.join(lambdasLocation, 'postRegistration')),
                functionName: this.properties.getAppRefName() + 'PostRegistrationFn',
                description: 'This function adds an user to the Players group after confirmation',
                memorySize: 128,
                timeout: 60,
                role: this.postRegistrationTriggerFunctionRole
            });
    }
}
exports.SecurityLayer = SecurityLayer;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VjdXJpdHlMYXllci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInNlY3VyaXR5TGF5ZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFDQSxnRUFBc0Y7QUFHdEYsZ0RBQWlEO0FBQ2pELHdDQUF5QztBQUN6Qyw4Q0FBK0M7QUFDL0MsbURBQW9EO0FBQ3BELE1BQU0sTUFBTSxHQUFHLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQztBQUVsQyxNQUFNLElBQUksR0FBRyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUM7QUFFN0IsTUFBTSxlQUFlLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUMsSUFBSSxFQUFDLElBQUksRUFBQyxTQUFTLENBQUMsQ0FBQztBQVNqRSxNQUFhLGFBQWMsU0FBUSwyQ0FBc0I7SUFhckQsYUFBYTtRQUNULE9BQU8sSUFBSSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUM7SUFDcEMsQ0FBQztJQUVELGNBQWM7UUFDVixJQUFJLEtBQUssR0FBRyxjQUFjLEdBQVksSUFBSSxDQUFDLFVBQVUsQ0FBQyxNQUFPLEdBQUcsaUJBQWlCLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUM7UUFDN0csT0FBTyxLQUFLLENBQUM7SUFDakIsQ0FBQztJQUdELGNBQWM7UUFDVixPQUFPLElBQUksQ0FBQyxRQUFRLENBQUMsV0FBVyxDQUFBO0lBQ3BDLENBQUM7SUFFRCxpQkFBaUI7UUFDYixPQUFPLElBQUksQ0FBQyxjQUFjLENBQUM7SUFDL0IsQ0FBQztJQUVELG1CQUFtQjtRQUNmLE9BQU8sSUFBSSxDQUFDLGNBQWMsQ0FBQyxnQkFBZ0IsQ0FBQztJQUNoRCxDQUFDO0lBRUQsZUFBZTtRQUNYLE9BQU8sSUFBSSxDQUFDLFlBQVksQ0FBQTtJQUM1QixDQUFDO0lBRUQsaUJBQWlCO1FBQ2IsT0FBTyxJQUFJLENBQUMsWUFBWSxDQUFDLGNBQWMsQ0FBQztJQUM1QyxDQUFDO0lBRUQsWUFBWSxNQUFpQixFQUFF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QyxVQUFVLENBQUMsYUFBYSxFQUFFLEdBQUcsa0JBQWtCLEVBQUU7Z0JBQzVFLE9BQU8sRUFBRSxNQUFNLENBQUMsT0FBTyxDQUFDLFNBQVM7Z0JBQ2pDLE9BQU8sRUFBRSxlQUFlO2dCQUN4QixJQUFJLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxlQUFlLEVBQUMsa0JBQWtCLENBQUMsQ0FBQztnQkFDcEUsWUFBWSxFQUFFLElBQUksQ0FBQyxVQUFVLENBQUMsYUFBYSxFQUFFLEdBQUcsb0JBQW9CO2dCQUNwRSxXQUFXLEVBQUUsb0VBQW9FO2dCQUNqRixVQUFVLEVBQUUsR0FBRztnQkFDZixPQUFPLEVBQUUsRUFBRTtnQkFDWCxJQUFJLEVBQUUsSUFBSSxDQUFDLG1DQUFtQzthQUNuRCxDQUFDLENBQUM7SUFDWCxDQUFDO0NBRUo7QUFsUkQsc0NBa1JDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnQGF3cy1jZGsvY2RrJztcbmltcG9ydCB7IFJlc291cmNlQXdhcmVDb25zdHJ1Y3QsIElQYXJhbWV0ZXJBd2FyZVByb3BzIH0gZnJvbSAnLi8uLi9yZXNvdXJjZWF3YXJlc3RhY2snXG5cblxuaW1wb3J0IENvZ25pdG8gPSByZXF1aXJlKCdAYXdzLWNkay9hd3MtY29nbml0bycpO1xuaW1wb3J0IElBTSA9IHJlcXVpcmUoJ0Bhd3MtY2RrL2F3cy1pYW0nKTtcbmltcG9ydCBMYW1iZGEgPSByZXF1aXJlKCdAYXdzLWNkay9hd3MtbGFtYmRhJyk7XG5pbXBvcnQgQ2ZuID0gcmVxdWlyZSgnQGF3cy1jZGsvYXdzLWNsb3VkZm9ybWF0aW9uJyk7XG5jb25zdCB1dWlkdjMgPSByZXF1aXJlKCd1dWlkL3YzJyk7XG5cbmNvbnN0IHBhdGggPSByZXF1aXJlKCdwYXRoJyk7XG5cbmNvbnN0IGxhbWJkYXNMb2NhdGlvbiA9IHBhdGguam9pbihfX2Rpcm5hbWUsJy4uJywnLi4nLCdsYW1iZGFzJyk7XG5leHBvcnQgaW50ZXJmYWNlIFNpbXBsZVVzZXJQb29sIHtcbiAgICB1c2VyUG9vbElkIDogc3RyaW5nLFxuICAgIHVzZXJQb29sVXJsIDogc3RyaW5nLFxuICAgIHVzZXJQb29sQXJuIDogc3RyaW5nLFxuICAgIHVzZXJQb29sUHJvdmlkZXJOYW1lIDogc3RyaW5nLFxuICAgIHVzZXJQb29sTmFtZSA6IHN0cmluZ1xufVxuXG5leHBvcnQgY2xhc3MgU2VjdXJpdHlMYXllciBleHRlbmRzIFJlc291cmNlQXdhcmVDb25zdHJ1Y3Qge1xuXG4gICAgdXNlclBvb2w6IFNpbXBsZVVzZXJQb29sO1xuICAgIHNpbXBsZVVzZXJQb29sIDogQ2ZuLkN1c3RvbVJlc291cmNlO1xuICAgIGlkZW50aXR5UG9vbDogQ29nbml0by5DZm5JZGVudGl0eVBvb2w7XG4gICAgdXNlclBvb2xDbGllbnQ6IENvZ25pdG8uQ2ZuVXNlclBvb2xDbGllbnQ7XG4gICAgcGxheWVyc1JvbGU6IElBTS5Sb2xlO1xuICAgIG1hbmFnZXJzUm9sZTogSUFNLlJvbGU7XG4gICAgdW5hdXRoZW50aWNhdGVkUm9sZTogSUFNLlJvbGU7XG4gICAgcG9zdFJlZ2lzdHJhdGlvblRyaWdnZXJGdW5jdGlvbiA6IExhbWJkYS5GdW5jdGlvbjtcbiAgICBwb3N0UmVnaXN0cmF0aW9uVHJpZ2dlckZ1bmN0aW9uUm9sZSA6IElBTS5Sb2xlO1xuICAgIFxuXG4gICAgZ2V0VXNlclBvb2xJZCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMudXNlclBvb2wudXNlclBvb2xJZDtcbiAgICB9XG5cbiAgICBnZXRVc2VyUG9vbFVybCgpIHtcbiAgICAgICAgbGV0IHZhbHVlID0gXCJjb2duaXRvLWlkcC5cIiArICg8c3RyaW5nPnRoaXMucHJvcGVydGllcy5yZWdpb24pICsgXCIuYW1hem9uYXdzLmNvbS9cIiArIHRoaXMudXNlclBvb2wudXNlclBvb2xJZDtcbiAgICAgICAgcmV0dXJuIHZhbHVlO1xuICAgIH1cblxuXG4gICAgZ2V0VXNlclBvb2xBcm4oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnVzZXJQb29sLnVzZXJQb29sQXJuXG4gICAgfVxuXG4gICAgZ2V0VXNlclBvb2xDbGllbnQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnVzZXJQb29sQ2xpZW50O1xuICAgIH1cblxuICAgIGdldFVzZXJQb29sQ2xpZW50SWQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnVzZXJQb29sQ2xpZW50LnVzZXJQb29sQ2xpZW50SWQ7XG4gICAgfVxuXG4gICAgZ2V0SWRlbnRpdHlQb29sKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5pZGVudGl0eVBvb2xcbiAgICB9XG5cbiAgICBnZXRJZGVudGl0eVBvb2xJZCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuaWRlbnRpdHlQb29sLmlkZW50aXR5UG9vbElkO1xuICAgIH1cblxuICAgIGNvbnN0cnVjdG9yKHBhcmVudDogQ29uc3RydWN0LCBuYW1lOiBzdHJpbmcsIHByb3BzOiBJUGFyYW1ldGVyQXdhcmVQcm9wcykge1xuICAgICAgICBzdXBlcihwYXJlbnQsIG5hbWUsIHByb3BzKTtcbiAgICAgICAgdGhpcy51c2VyUG9vbCA9IHtcbiAgICAgICAgICAgIHVzZXJQb29sSWQgOiAnJyxcbiAgICAgICAgICAgIHVzZXJQb29sVXJsIDogJycsXG4gICAgICAgICAgICB1c2VyUG9vbEFybiA6ICcnLFxuICAgICAgICAgICAgdXNlclBvb2xQcm92aWRlck5hbWUgOiAnJyxcbiAgICAgICAgICAgIHVzZXJQb29sTmFtZSA6ICcnLCAgICAgICBcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmNyZWF0UG9zdFJlZ2lzdHJhdGlvbkxhbWJkYVRyaWdnZXIoKTtcbiAgICAgICAgdGhpcy5jcmVhdGVVc2VyUG9vbCgpO1xuICAgICAgICB0aGlzLmNyZWF0ZVVzZXJQb29sQ2xpZW50QXBwKCk7XG4gICAgICAgIHRoaXMuY3JlYXRlSWRlbnRpdHlQb29sKCk7XG4gICAgICAgIHRoaXMuY3JlYXRlVXNlclBvb2xHcm91cHMoKTtcbiAgICAgICAgdGhpcy5jb25maWd1cmVJZGVudGl0eVBvb2xSb2xlcygpO1xuICAgIH1cblxuICAgIHByaXZhdGUgY3JlYXRlVXNlclBvb2woKSB7XG5cbiAgICAgICAgY29uc3QgQ0RLTkFNRVNQQUNFID0gJ2FhNTk2Y2VlLTQ1MWItMTFlOS1iMjEwLWQ2NjNiZDg3M2Q5Myc7XG4gICAgICAgIGxldCBnZW5GdW5jdGlvbklkID0gdGhpcy5wcm9wZXJ0aWVzLmdldEFwcFJlZk5hbWUoKSsnU2ltcGxlVXNlclBvb2xHZW5Gbic7XG4gICAgICAgIGNvbnN0IGdlbmVyYXRpbmdGdW5jdGlvbiA9IG5ldyBMYW1iZGEuU2luZ2xldG9uRnVuY3Rpb24odGhpcywgZ2VuRnVuY3Rpb25JZCwge1xuICAgICAgICAgICAgICAgICAvLyBUbyBhdm9pZCBoYXZpbmcgYSBVVUlEIGZ1bmN0aW9uIGdlbmVyYXRlZCBhdCBldmVyeSBydW4sIHdlIHdpbGwgdXNlXG4gICAgICAgICAgICAgICAgIC8vIHV1aWR2MyB0byBzdGljayB0byBzb21lICdhbGVhdG9yeScgdXVpZCByZWxhdGVkIHRvIHRoZSBnZW5GdW5jdGlvbklkXG4gICAgICAgICAgICAgICAgIHV1aWQgOiB1dWlkdjMoZ2VuRnVuY3Rpb25JZCxDREtOQU1FU1BBQ0UpXG4gICAgICAgICAgICAgICAgLGNvZGUgOiBuZXcgTGFtYmRhLkFzc2V0Q29kZShwYXRoLmpvaW4obGFtYmRhc0xvY2F0aW9uLCdzaW1wbGVVc2VyUG9vbCcpKVxuICAgICAgICAgICAgICAgLGRlc2NyaXB0aW9uIDogXCJHZW5lcmF0ZXMgdGhlIFVzZXJQb29sIHVzaW5nIGNvbmZpZ3VyYXRpb24gbm90IGF2YWlsYWJsZSBvbiBDREtcIlxuICAgICAgICAgICAgICAgLGhhbmRsZXIgOiAnaW5kZXguaGFuZGxlcidcbiAgICAgICAgICAgICAgICx0aW1lb3V0IDogMzAwXG4gICAgICAgICAgICAgICAscnVudGltZSA6IExhbWJkYS5SdW50aW1lLk5vZGVKUzYxMFxuICAgICAgICAgICB9KTtcbiAgIFxuICAgICAgICAgICBnZW5lcmF0aW5nRnVuY3Rpb24uYWRkVG9Sb2xlUG9saWN5KCBuZXcgSUFNLlBvbGljeVN0YXRlbWVudCgpXG4gICAgICAgICAgICAgICAuYWxsb3coKVxuICAgICAgICAgICAgICAgLmFkZEFjdGlvbnMoXG4gICAgICAgICAgICAgICAgICAgXCJjb2duaXRvLWlkcDpEZWxldGVVc2VyUG9vbFwiLFxuICAgICAgICAgICAgICAgICAgIFwiY29nbml0by1pZHA6Q3JlYXRlVXNlclBvb2xcIixcbiAgICAgICAgICAgICAgICAgICBcImNvZ25pdG8taWRwOlVwZGF0ZVVzZXJQb29sXCIsXG4gICAgICAgICAgICAgICAgICAgXCJjb2duaXRvLWlkcDpDcmVhdGVVc2VyUG9vbERvbWFpblwiLFxuICAgICAgICAgICAgICAgICAgIFwiY29nbml0by1pZHA6RGVsZXRlVXNlclBvb2xEb21haW5cIlxuICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICAgLmFkZEFsbFJlc291cmNlcygpXG4gICAgICAgICAgICk7XG4gICBcbiAgICAgICAgICAgdGhpcy5zaW1wbGVVc2VyUG9vbCA9IG5ldyBDZm4uQ3VzdG9tUmVzb3VyY2UodGhpcywgdGhpcy5wcm9wZXJ0aWVzLmdldEFwcFJlZk5hbWUoKSsnU2ltcGxlVXNlclBvb2xDdXN0b21SZXNvdXJjZScse1xuICAgICAgICAgICAgICAgIGxhbWJkYVByb3ZpZGVyIDogZ2VuZXJhdGluZ0Z1bmN0aW9uXG4gICAgICAgICAgICAgICAsIHByb3BlcnRpZXMgOiB7XG4gICAgICAgICAgICAgICAgICAgQXBwTmFtZSA6IHRoaXMucHJvcGVydGllcy5nZXRBcHBSZWZOYW1lKCksXG4gICAgICAgICAgICAgICAgICAgVXNlclBvb2xOYW1lIDogdGhpcy5wcm9wZXJ0aWVzLmdldEFwcFJlZk5hbWUoKSxcbiAgICAgICAgICAgICAgICAgICBQb3N0Q29uZmlybWF0aW9uTGFtYmRhQXJuIDogdGhpcy5wb3N0UmVnaXN0cmF0aW9uVHJpZ2dlckZ1bmN0aW9uLmZ1bmN0aW9uQXJuXG4gICAgICAgICAgICAgICB9XG4gICAgICAgICAgIH0pO1xuICAgXG4gICAgICAgICAgIHRoaXMudXNlclBvb2wudXNlclBvb2xJZCA9IHRoaXMuc2ltcGxlVXNlclBvb2wuZ2V0QXR0KCdVc2VyUG9vbElkJykudG9TdHJpbmcoKTtcbiAgICAgICAgICAgdGhpcy51c2VyUG9vbC51c2VyUG9vbEFybiA9IHRoaXMuc2ltcGxlVXNlclBvb2wuZ2V0QXR0KCdVc2VyUG9vbEFybicpLnRvU3RyaW5nKCk7XG4gICAgICAgICAgIHRoaXMudXNlclBvb2wudXNlclBvb2xQcm92aWRlck5hbWUgPSB0aGlzLnNpbXBsZVVzZXJQb29sLmdldEF0dCgnVXNlclBvb2xQcm92aWRlck5hbWUnKS50b1N0cmluZygpO1xuICAgICAgICAgICB0aGlzLnVzZXJQb29sLnVzZXJQb29sTmFtZSA9IHRoaXMuc2ltcGxlVXNlclBvb2wuZ2V0QXR0KCdVc2VyUG9vbE5hbWUnKS50b1N0cmluZygpO1xuXG4gICAgICAgICAgIC8vIEdpdmVzIHBlcm1pc3Npb24gZm9yIHVzZXJwb29sIHRvIGNhbGwgdGhlIGxhbWJkYSB0cmlnZ2VyXG4gICAgICAgICAgIG5ldyBMYW1iZGEuQ2ZuUGVybWlzc2lvbih0aGlzLCB0aGlzLnByb3BlcnRpZXMuZ2V0QXBwUmVmTmFtZSgpKydVc2VyUG9vbFBlcm0nLCB7XG4gICAgICAgICAgICAgICAgYWN0aW9uIDogJ2xhbWJkYTppbnZva2VGdW5jdGlvbidcbiAgICAgICAgICAgICAgICxwcmluY2lwYWwgOiAnY29nbml0by1pZHAuYW1hem9uYXdzLmNvbSdcbiAgICAgICAgICAgICAgICxmdW5jdGlvbk5hbWUgOiB0aGlzLnBvc3RSZWdpc3RyYXRpb25UcmlnZ2VyRnVuY3Rpb24uZnVuY3Rpb25OYW1lXG4gICAgICAgICAgICAgICAsc291cmNlQXJuIDogdGhpcy51c2VyUG9vbC51c2VyUG9vbEFyblxuICAgICAgICAgICB9KVxuXG4gICAgICAgIGxldCBwb2xpY3kgPSBuZXcgSUFNLlBvbGljeSh0aGlzLHRoaXMucHJvcGVydGllcy5nZXRBcHBSZWZOYW1lKCkrJ1RyaWdnZXJGdW5jdGlvblBvbGljeScse1xuICAgICAgICAgICAgcG9saWN5TmFtZSA6ICdBbGxvd0FkZFVzZXJUb0dyb3VwJ1xuICAgICAgICB9KTtcblxuICAgICAgICBwb2xpY3kuYWRkU3RhdGVtZW50KFxuICAgICAgICAgICAgbmV3IElBTS5Qb2xpY3lTdGF0ZW1lbnQoKVxuICAgICAgICAgICAgICAgIC5hbGxvdygpXG4gICAgICAgICAgICAgICAgLmFkZFJlc291cmNlKHRoaXMudXNlclBvb2wudXNlclBvb2xBcm4pXG4gICAgICAgICAgICAgICAgLmFkZEFjdGlvbignY29nbml0by1pZHA6QWRtaW5BZGRVc2VyVG9Hcm91cCcpXG4gICAgICAgIClcbiAgICAgICAgdGhpcy5wb3N0UmVnaXN0cmF0aW9uVHJpZ2dlckZ1bmN0aW9uUm9sZS5hdHRhY2hJbmxpbmVQb2xpY3kocG9saWN5KTtcblxuICAgICAgICB0aGlzLmFkZFJlc291cmNlKCdzZWN1cml0eS51c2VycG9vbCcsIHRoaXMudXNlclBvb2wpO1xuICAgIH1cblxuXG4gICAgcHJpdmF0ZSBjcmVhdGVVc2VyUG9vbENsaWVudEFwcCgpIHtcbiAgICAgICAgdGhpcy51c2VyUG9vbENsaWVudCA9IG5ldyBDb2duaXRvLkNmblVzZXJQb29sQ2xpZW50KHRoaXMsIHRoaXMucHJvcGVydGllcy5nZXRBcHBSZWZOYW1lKCkgKyAnQXBwJywge1xuICAgICAgICAgICAgdXNlclBvb2xJZDogdGhpcy51c2VyUG9vbC51c2VyUG9vbElkLFxuICAgICAgICAgICAgY2xpZW50TmFtZTogdGhpcy5wcm9wZXJ0aWVzLmdldEFwcFJlZk5hbWUoKSArICdXZWJzaXRlJyxcbiAgICAgICAgICAgIGdlbmVyYXRlU2VjcmV0OiBmYWxzZSxcbiAgICAgICAgICAgIGV4cGxpY2l0QXV0aEZsb3dzIDogWyBcIlVTRVJfUEFTU1dPUkRfQVVUSFwiIF1cbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuYWRkUmVzb3VyY2UoJ3NlY3VyaXR5LnVzZXJwb29sY2xpZW50JywgdGhpcy51c2VyUG9vbENsaWVudCk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBjcmVhdGVJZGVudGl0eVBvb2woKSB7XG4gICAgICAgIHRoaXMuaWRlbnRpdHlQb29sID0gbmV3IENvZ25pdG8uQ2ZuSWRlbnRpdHlQb29sKHRoaXMsIHRoaXMucHJvcGVydGllcy5nZXRBcHBSZWZOYW1lKCkgKyAnSWRlbnRpdHlQb29sJywge1xuICAgICAgICAgICAgaWRlbnRpdHlQb29sTmFtZTogdGhpcy5wcm9wZXJ0aWVzLmdldEFwcFJlZk5hbWUoKSxcbiAgICAgICAgICAgIGFsbG93VW5hdXRoZW50aWNhdGVkSWRlbnRpdGllczogZmFsc2UsXG4gICAgICAgICAgICBjb2duaXRvSWRlbnRpdHlQcm92aWRlcnM6IFtcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIGNsaWVudElkOiB0aGlzLnVzZXJQb29sQ2xpZW50LnVzZXJQb29sQ2xpZW50SWQsXG4gICAgICAgICAgICAgICAgICAgIHByb3ZpZGVyTmFtZTogdGhpcy51c2VyUG9vbC51c2VyUG9vbFByb3ZpZGVyTmFtZSxcbiAgICAgICAgICAgICAgICAgICAgc2VydmVyU2lkZVRva2VuQ2hlY2s6IGZhbHNlXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgXVxuICAgICAgICB9KVxuICAgICAgICB0aGlzLmlkZW50aXR5UG9vbC5hZGREZXBlbmRzT24odGhpcy5zaW1wbGVVc2VyUG9vbCk7XG4gICAgICAgIHRoaXMuYWRkUmVzb3VyY2UoJ3NlY3VyaXR5LmlkZW50aXR5cG9vbCcsIHRoaXMuaWRlbnRpdHlQb29sKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGNyZWF0ZVVzZXJQb29sR3JvdXBzKCkge1xuICAgICAgICAvLyBQTEFZRVJTXG4gICAgICAgIHRoaXMucGxheWVyc1JvbGUgPSBuZXcgSUFNLlJvbGUodGhpcywgdGhpcy5wcm9wZXJ0aWVzLmdldEFwcFJlZk5hbWUoKSArICdQbGF5ZXJzUm9sZScsIHtcbiAgICAgICAgICAgIHJvbGVOYW1lIDogdGhpcy5wcm9wZXJ0aWVzLmdldEFwcFJlZk5hbWUoKSArICdQbGF5ZXJzUm9sZScsXG4gICAgICAgICAgICBhc3N1bWVkQnk6IG5ldyBJQU0uRmVkZXJhdGVkUHJpbmNpcGFsKCdjb2duaXRvLWlkZW50aXR5LmFtYXpvbmF3cy5jb20nLCB7XG4gICAgICAgICAgICAgICAgXCJTdHJpbmdFcXVhbHNcIjogeyBcImNvZ25pdG8taWRlbnRpdHkuYW1hem9uYXdzLmNvbTphdWRcIjogdGhpcy5pZGVudGl0eVBvb2wuaWRlbnRpdHlQb29sSWQgfSxcbiAgICAgICAgICAgICAgICBcIkZvckFueVZhbHVlOlN0cmluZ0xpa2VcIjogeyBcImNvZ25pdG8taWRlbnRpdHkuYW1hem9uYXdzLmNvbTphbXJcIjogXCJhdXRoZW50aWNhdGVkXCIgfVxuICAgICAgICAgICAgfSxcInN0czpBc3N1bWVSb2xlV2l0aFdlYklkZW50aXR5XCIpXG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLnBsYXllcnNSb2xlLmFkZFRvUG9saWN5KG5ldyBJQU0uUG9saWN5U3RhdGVtZW50KClcbiAgICAgICAgICAgIC5hbGxvdygpXG4gICAgICAgICAgICAuYWRkQWN0aW9uKFwibW9iaWxlYW5hbHl0aWNzOlB1dEV2ZW50c1wiKVxuICAgICAgICAgICAgLmFkZEFjdGlvbihcImNvZ25pdG8tc3luYzoqXCIpXG4gICAgICAgICAgICAuYWRkQWN0aW9ucyhcImNvZ25pdG8taWRlbnRpdHk6KlwiKVxuICAgICAgICAgICAgLmFkZEFsbFJlc291cmNlcygpXG4gICAgICAgICk7XG4gICAgICAgIHRoaXMuYWRkUmVzb3VyY2UoJ3NlY3VyaXR5LnBsYXllcnNyb2xlJyx0aGlzLnBsYXllcnNSb2xlKTtcblxuICAgICAgICBuZXcgQ29nbml0by5DZm5Vc2VyUG9vbEdyb3VwKHRoaXMsIHRoaXMucHJvcGVydGllcy5nZXRBcHBSZWZOYW1lKCkgKyAnUGxheWVycycsIHtcbiAgICAgICAgICAgIGdyb3VwTmFtZTogJ1BsYXllcnMnLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246ICdQbGF5ZXJzIG9mIHRoZSBnYW1lLicsXG4gICAgICAgICAgICBwcmVjZWRlbmNlOiA5OTk5LFxuICAgICAgICAgICAgcm9sZUFybjogdGhpcy5wbGF5ZXJzUm9sZS5yb2xlQXJuLFxuICAgICAgICAgICAgdXNlclBvb2xJZDogdGhpcy51c2VyUG9vbC51c2VyUG9vbElkXG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIE1BTkFHRVJTXG4gICAgICAgIHRoaXMubWFuYWdlcnNSb2xlID0gbmV3IElBTS5Sb2xlKHRoaXMsIHRoaXMucHJvcGVydGllcy5nZXRBcHBSZWZOYW1lKCkgKyAnTWFuYWdlcnNSb2xlJywge1xuICAgICAgICAgICAgcm9sZU5hbWUgOiB0aGlzLnByb3BlcnRpZXMuZ2V0QXBwUmVmTmFtZSgpICsgJ01hbmFnZXJzUm9sZScsXG4gICAgICAgICAgICBhc3N1bWVkQnk6IG5ldyBJQU0uRmVkZXJhdGVkUHJpbmNpcGFsKCdjb2duaXRvLWlkZW50aXR5LmFtYXpvbmF3cy5jb20nLCB7XG4gICAgICAgICAgICAgICAgXCJTdHJpbmdFcXVhbHNcIjogeyBcImNvZ25pdG8taWRlbnRpdHkuYW1hem9uYXdzLmNvbTphdWRcIjogdGhpcy5pZGVudGl0eVBvb2wuaWRlbnRpdHlQb29sSWQgfSxcbiAgICAgICAgICAgICAgICBcIkZvckFueVZhbHVlOlN0cmluZ0xpa2VcIjogeyBcImNvZ25pdG8taWRlbnRpdHkuYW1hem9uYXdzLmNvbTphbXJcIjogXCJhdXRoZW50aWNhdGVkXCIgfVxuICAgICAgICAgICAgfSxcInN0czpBc3N1bWVSb2xlV2l0aFdlYklkZW50aXR5XCIpXG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLm1hbmFnZXJzUm9sZS5hdHRhY2hNYW5hZ2VkUG9saWN5KCdhcm46YXdzOmlhbTo6YXdzOnBvbGljeS9BbWF6b25Db2duaXRvUG93ZXJVc2VyJyk7XG4gICAgICAgIHRoaXMubWFuYWdlcnNSb2xlLmFkZFRvUG9saWN5KG5ldyBJQU0uUG9saWN5U3RhdGVtZW50KClcbiAgICAgICAgICAgIC5hbGxvdygpXG4gICAgICAgICAgICAuYWRkQWN0aW9uKFwibW9iaWxlYW5hbHl0aWNzOlB1dEV2ZW50c1wiKVxuICAgICAgICAgICAgLmFkZEFjdGlvbihcImNvZ25pdG8tc3luYzoqXCIpXG4gICAgICAgICAgICAuYWRkQWN0aW9ucyhcImNvZ25pdG8taWRlbnRpdHk6KlwiKVxuICAgICAgICAgICAgLmFkZEFsbFJlc291cmNlcygpXG4gICAgICAgICk7XG4gICAgICAgIHRoaXMuYWRkUmVzb3VyY2UoJ3NlY3VyaXR5Lm1hbmFnZXJzcm9sZScsdGhpcy5tYW5hZ2Vyc1JvbGUpO1xuICAgICAgICBuZXcgQ29nbml0by5DZm5Vc2VyUG9vbEdyb3VwKHRoaXMsIHRoaXMucHJvcGVydGllcy5nZXRBcHBSZWZOYW1lKCkgKyAnTWFuYWdlcnMnLCB7XG4gICAgICAgICAgICBncm91cE5hbWU6ICdNYW5hZ2VycycsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogJ01hbmFnZXJzIG9mIHRoZSBnYW1lLicsXG4gICAgICAgICAgICBwcmVjZWRlbmNlOiAwLFxuICAgICAgICAgICAgcm9sZUFybjogdGhpcy5tYW5hZ2Vyc1JvbGUucm9sZUFybixcbiAgICAgICAgICAgIHVzZXJQb29sSWQ6IHRoaXMudXNlclBvb2wudXNlclBvb2xJZFxuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGNvbmZpZ3VyZUlkZW50aXR5UG9vbFJvbGVzKCkge1xuICAgICAgICB0aGlzLnVuYXV0aGVudGljYXRlZFJvbGUgPSBuZXcgSUFNLlJvbGUodGhpcywgdGhpcy5wcm9wZXJ0aWVzLmdldEFwcFJlZk5hbWUoKSArICdVbmF1dGhSb2xlJywge1xuICAgICAgICAgICAgcm9sZU5hbWUgOiB0aGlzLnByb3BlcnRpZXMuZ2V0QXBwUmVmTmFtZSgpICsgJ1VuYXV0aFJvbGUnLFxuICAgICAgICAgICAgYXNzdW1lZEJ5OiBuZXcgSUFNLkZlZGVyYXRlZFByaW5jaXBhbCgnY29nbml0by1pZGVudGl0eS5hbWF6b25hd3MuY29tJywge1xuICAgICAgICAgICAgICAgIFwiU3RyaW5nRXF1YWxzXCI6IHsgXCJjb2duaXRvLWlkZW50aXR5LmFtYXpvbmF3cy5jb206YXVkXCI6IHRoaXMuaWRlbnRpdHlQb29sLmlkZW50aXR5UG9vbElkIH0sXG4gICAgICAgICAgICAgICAgXCJGb3JBbnlWYWx1ZTpTdHJpbmdMaWtlXCI6IHsgXCJjb2duaXRvLWlkZW50aXR5LmFtYXpvbmF3cy5jb206YW1yXCI6IFwidW5hdXRoZW50aWNhdGVkXCIgfVxuICAgICAgICAgICAgfSlcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMudW5hdXRoZW50aWNhdGVkUm9sZS5hZGRUb1BvbGljeShuZXcgSUFNLlBvbGljeVN0YXRlbWVudCgpXG4gICAgICAgICAgICAuYWxsb3coKVxuICAgICAgICAgICAgLmFkZEFjdGlvbihcIm1vYmlsZWFuYWx5dGljczpQdXRFdmVudHNcIilcbiAgICAgICAgICAgIC5hZGRBY3Rpb24oXCJjb2duaXRvLXN5bmM6KlwiKVxuICAgICAgICAgICAgLmFkZEFjdGlvbnMoXCJjb2duaXRvLWlkZW50aXR5OipcIilcbiAgICAgICAgICAgIC5hZGRBbGxSZXNvdXJjZXMoKVxuICAgICAgICApOyBcbiAgICAgICAgXG5cbiAgICAgICAgbmV3IENvZ25pdG8uQ2ZuSWRlbnRpdHlQb29sUm9sZUF0dGFjaG1lbnQodGhpcywgdGhpcy5wcm9wZXJ0aWVzLmdldEFwcFJlZk5hbWUoKSArIFwiSURQUm9sZXNcIixcbiAgICAgICAge1xuICAgICAgICAgICAgaWRlbnRpdHlQb29sSWQgOiB0aGlzLmlkZW50aXR5UG9vbC5pZGVudGl0eVBvb2xJZFxuICAgICAgICAgICAscm9sZXMgOiB7XG4gICAgICAgICAgICAgICBhdXRoZW50aWNhdGVkIDogdGhpcy5wbGF5ZXJzUm9sZS5yb2xlQXJuLFxuICAgICAgICAgICAgICAgdW5hdXRoZW50aWNhdGVkIDogdGhpcy51bmF1dGhlbnRpY2F0ZWRSb2xlLnJvbGVBcm5cbiAgICAgICAgICAgfVxuICAgICAgICAgICAvLyBUTy1ETyBJZGVudGlmeSB3aXRoIHRoZSB0ZWFtIGZyb20gQ0RLIGhvdyB0byBpbXBsZW1lbnQgdGhpc1xuICAgICAgIC8qICAgICxyb2xlTWFwcGluZ3MgOiB7XG4gICAgICAgICAgICAgICB0eXBlOiBcIlJ1bGVzXCIsXG4gICAgICAgICAgICAgICBhbWJpZ3VvdXNSb2xlUmVzb2x1dGlvbjogXCJEZW55XCIsXG4gICAgICAgICAgICAgICBydWxlc0NvbmZpZ3VyYXRpb246IHtcbiAgICAgICAgICAgICAgICAgICBydWxlczogW1xuICAgICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICBjbGFpbTogXCJjb2duaXRvOnByZWZlcnJlZF9yb2xlXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICBtYXRjaFR5cGU6IFwiQ29udGFpbnNcIixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlOiBcIk1hbmFnZXJzXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICByb2xlQXJuOiB0aGlzLm1hbmFnZXJzUm9sZVxuICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICBjbGFpbTogXCJjb2duaXRvOnByZWZlcnJlZF9yb2xlXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICBtYXRjaFR5cGU6IFwiQ29udGFpbnNcIixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlOiBcIlBsYXllcnNcIixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgIHJvbGVBcm46IHRoaXMucGxheWVyc1JvbGVcbiAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgfVxuICAgICAgICAgICAqL1xuICAgICAgIH0pO1xuXG4gICAgfVxuXG4gICAgcHJpdmF0ZSBjcmVhdFBvc3RSZWdpc3RyYXRpb25MYW1iZGFUcmlnZ2VyKCkge1xuXG4gICAgICAgIHRoaXMucG9zdFJlZ2lzdHJhdGlvblRyaWdnZXJGdW5jdGlvblJvbGUgPSBuZXcgSUFNLlJvbGUodGhpcywgdGhpcy5wcm9wZXJ0aWVzLmdldEFwcFJlZk5hbWUoKSArICdQb3N0UmVnaXN0cmF0aW9uRm5fUm9sZScsIHtcbiAgICAgICAgICAgIHJvbGVOYW1lOiB0aGlzLnByb3BlcnRpZXMuZ2V0QXBwUmVmTmFtZSgpICsgJ1Bvc3RSZWdpc3RyYXRpb25Gbl9Sb2xlJ1xuICAgICAgICAgICAgLCBhc3N1bWVkQnk6IG5ldyBJQU0uU2VydmljZVByaW5jaXBhbCgnbGFtYmRhLmFtYXpvbmF3cy5jb20nKVxuICAgICAgICAgICAgLCBtYW5hZ2VkUG9saWN5QXJuczogWydhcm46YXdzOmlhbTo6YXdzOnBvbGljeS9zZXJ2aWNlLXJvbGUvQVdTTGFtYmRhQmFzaWNFeGVjdXRpb25Sb2xlJ11cbiAgICAgICAgfSk7XG4gICAgICAgIFxuICAgICAgICB0aGlzLnBvc3RSZWdpc3RyYXRpb25UcmlnZ2VyRnVuY3Rpb24gPVxuICAgICAgICAgICAgbmV3IExhbWJkYS5GdW5jdGlvbih0aGlzLCB0aGlzLnByb3BlcnRpZXMuZ2V0QXBwUmVmTmFtZSgpICsgJ1Bvc3RSZWdpc3RyYXRpb24nLCB7XG4gICAgICAgICAgICAgICAgcnVudGltZTogTGFtYmRhLlJ1bnRpbWUuTm9kZUpTODEwLFxuICAgICAgICAgICAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcbiAgICAgICAgICAgICAgICBjb2RlOiBMYW1iZGEuQ29kZS5hc3NldChwYXRoLmpvaW4obGFtYmRhc0xvY2F0aW9uLCdwb3N0UmVnaXN0cmF0aW9uJykpXG4gICAgICAgICAgICAgICAgLCBmdW5jdGlvbk5hbWU6IHRoaXMucHJvcGVydGllcy5nZXRBcHBSZWZOYW1lKCkgKyAnUG9zdFJlZ2lzdHJhdGlvbkZuJ1xuICAgICAgICAgICAgICAgICwgZGVzY3JpcHRpb246ICdUaGlzIGZ1bmN0aW9uIGFkZHMgYW4gdXNlciB0byB0aGUgUGxheWVycyBncm91cCBhZnRlciBjb25maXJtYXRpb24nXG4gICAgICAgICAgICAgICAgLCBtZW1vcnlTaXplOiAxMjhcbiAgICAgICAgICAgICAgICAsIHRpbWVvdXQ6IDYwXG4gICAgICAgICAgICAgICAgLCByb2xlOiB0aGlzLnBvc3RSZWdpc3RyYXRpb25UcmlnZ2VyRnVuY3Rpb25Sb2xlIFxuICAgICAgICAgICAgfSk7XG4gICAgfVxuXG59Il19