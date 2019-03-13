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
            // To avoid collisions when running the on the same environment
            // many times, we're using uuidv3 to stick to some 'aleatory' 
            // uuid related to the genFunctionId
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VjdXJpdHlMYXllci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInNlY3VyaXR5TGF5ZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFDQSxnRUFBc0Y7QUFHdEYsZ0RBQWlEO0FBQ2pELHdDQUF5QztBQUN6Qyw4Q0FBK0M7QUFDL0MsbURBQW9EO0FBQ3BELE1BQU0sTUFBTSxHQUFHLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQztBQUVsQyxNQUFNLElBQUksR0FBRyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUM7QUFFN0IsTUFBTSxlQUFlLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUMsSUFBSSxFQUFDLElBQUksRUFBQyxTQUFTLENBQUMsQ0FBQztBQVNqRSxNQUFhLGFBQWMsU0FBUSwyQ0FBc0I7SUFhckQsYUFBYTtRQUNULE9BQU8sSUFBSSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUM7SUFDcEMsQ0FBQztJQUVELGNBQWM7UUFDVixJQUFJLEtBQUssR0FBRyxjQUFjLEdBQVksSUFBSSxDQUFDLFVBQVUsQ0FBQyxNQUFPLEdBQUcsaUJBQWlCLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUM7UUFDN0csT0FBTyxLQUFLLENBQUM7SUFDakIsQ0FBQztJQUdELGNBQWM7UUFDVixPQUFPLElBQUksQ0FBQyxRQUFRLENBQUMsV0FBVyxDQUFBO0lBQ3BDLENBQUM7SUFFRCxpQkFBaUI7UUFDYixPQUFPLElBQUksQ0FBQyxjQUFjLENBQUM7SUFDL0IsQ0FBQztJQUVELG1CQUFtQjtRQUNmLE9BQU8sSUFBSSxDQUFDLGNBQWMsQ0FBQyxnQkFBZ0IsQ0FBQztJQUNoRCxDQUFDO0lBRUQsZUFBZTtRQUNYLE9BQU8sSUFBSSxDQUFDLFlBQVksQ0FBQTtJQUM1QixDQUFDO0lBRUQsaUJBQWlCO1FBQ2IsT0FBTyxJQUFJLENBQUMsWUFBWSxDQUFDLGNBQWMsQ0FBQztJQUM1QyxDQUFDO0lBRUQsWUFBWSxNQUFpQixFQUFF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RUFBRSxJQUFJLENBQUMsVUFBVSxDQUFDLGFBQWEsRUFBRSxHQUFHLGtCQUFrQixFQUFFO2dCQUM1RSxPQUFPLEVBQUUsTUFBTSxDQUFDLE9BQU8sQ0FBQyxTQUFTO2dCQUNqQyxPQUFPLEVBQUUsZUFBZTtnQkFDeEIsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsZUFBZSxFQUFDLGtCQUFrQixDQUFDLENBQUM7Z0JBQ3BFLFlBQVksRUFBRSxJQUFJLENBQUMsVUFBVSxDQUFDLGFBQWEsRUFBRSxHQUFHLG9CQUFvQjtnQkFDcEUsV0FBVyxFQUFFLG9FQUFvRTtnQkFDakYsVUFBVSxFQUFFLEdBQUc7Z0JBQ2YsT0FBTyxFQUFFLEVBQUU7Z0JBQ1gsSUFBSSxFQUFFLElBQUksQ0FBQyxtQ0FBbUM7YUFDbkQsQ0FBQyxDQUFDO0lBQ1gsQ0FBQztDQUVKO0FBblJELHNDQW1SQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ0Bhd3MtY2RrL2Nkayc7XG5pbXBvcnQgeyBSZXNvdXJjZUF3YXJlQ29uc3RydWN0LCBJUGFyYW1ldGVyQXdhcmVQcm9wcyB9IGZyb20gJy4vLi4vcmVzb3VyY2Vhd2FyZXN0YWNrJ1xuXG5cbmltcG9ydCBDb2duaXRvID0gcmVxdWlyZSgnQGF3cy1jZGsvYXdzLWNvZ25pdG8nKTtcbmltcG9ydCBJQU0gPSByZXF1aXJlKCdAYXdzLWNkay9hd3MtaWFtJyk7XG5pbXBvcnQgTGFtYmRhID0gcmVxdWlyZSgnQGF3cy1jZGsvYXdzLWxhbWJkYScpO1xuaW1wb3J0IENmbiA9IHJlcXVpcmUoJ0Bhd3MtY2RrL2F3cy1jbG91ZGZvcm1hdGlvbicpO1xuY29uc3QgdXVpZHYzID0gcmVxdWlyZSgndXVpZC92MycpO1xuXG5jb25zdCBwYXRoID0gcmVxdWlyZSgncGF0aCcpO1xuXG5jb25zdCBsYW1iZGFzTG9jYXRpb24gPSBwYXRoLmpvaW4oX19kaXJuYW1lLCcuLicsJy4uJywnbGFtYmRhcycpO1xuZXhwb3J0IGludGVyZmFjZSBTaW1wbGVVc2VyUG9vbCB7XG4gICAgdXNlclBvb2xJZCA6IHN0cmluZyxcbiAgICB1c2VyUG9vbFVybCA6IHN0cmluZyxcbiAgICB1c2VyUG9vbEFybiA6IHN0cmluZyxcbiAgICB1c2VyUG9vbFByb3ZpZGVyTmFtZSA6IHN0cmluZyxcbiAgICB1c2VyUG9vbE5hbWUgOiBzdHJpbmdcbn1cblxuZXhwb3J0IGNsYXNzIFNlY3VyaXR5TGF5ZXIgZXh0ZW5kcyBSZXNvdXJjZUF3YXJlQ29uc3RydWN0IHtcblxuICAgIHVzZXJQb29sOiBTaW1wbGVVc2VyUG9vbDtcbiAgICBzaW1wbGVVc2VyUG9vbCA6IENmbi5DdXN0b21SZXNvdXJjZTtcbiAgICBpZGVudGl0eVBvb2w6IENvZ25pdG8uQ2ZuSWRlbnRpdHlQb29sO1xuICAgIHVzZXJQb29sQ2xpZW50OiBDb2duaXRvLkNmblVzZXJQb29sQ2xpZW50O1xuICAgIHBsYXllcnNSb2xlOiBJQU0uUm9sZTtcbiAgICBtYW5hZ2Vyc1JvbGU6IElBTS5Sb2xlO1xuICAgIHVuYXV0aGVudGljYXRlZFJvbGU6IElBTS5Sb2xlO1xuICAgIHBvc3RSZWdpc3RyYXRpb25UcmlnZ2VyRnVuY3Rpb24gOiBMYW1iZGEuRnVuY3Rpb247XG4gICAgcG9zdFJlZ2lzdHJhdGlvblRyaWdnZXJGdW5jdGlvblJvbGUgOiBJQU0uUm9sZTtcbiAgICBcblxuICAgIGdldFVzZXJQb29sSWQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnVzZXJQb29sLnVzZXJQb29sSWQ7XG4gICAgfVxuXG4gICAgZ2V0VXNlclBvb2xVcmwoKSB7XG4gICAgICAgIGxldCB2YWx1ZSA9IFwiY29nbml0by1pZHAuXCIgKyAoPHN0cmluZz50aGlzLnByb3BlcnRpZXMucmVnaW9uKSArIFwiLmFtYXpvbmF3cy5jb20vXCIgKyB0aGlzLnVzZXJQb29sLnVzZXJQb29sSWQ7XG4gICAgICAgIHJldHVybiB2YWx1ZTtcbiAgICB9XG5cblxuICAgIGdldFVzZXJQb29sQXJuKCkge1xuICAgICAgICByZXR1cm4gdGhpcy51c2VyUG9vbC51c2VyUG9vbEFyblxuICAgIH1cblxuICAgIGdldFVzZXJQb29sQ2xpZW50KCkge1xuICAgICAgICByZXR1cm4gdGhpcy51c2VyUG9vbENsaWVudDtcbiAgICB9XG5cbiAgICBnZXRVc2VyUG9vbENsaWVudElkKCkge1xuICAgICAgICByZXR1cm4gdGhpcy51c2VyUG9vbENsaWVudC51c2VyUG9vbENsaWVudElkO1xuICAgIH1cblxuICAgIGdldElkZW50aXR5UG9vbCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuaWRlbnRpdHlQb29sXG4gICAgfVxuXG4gICAgZ2V0SWRlbnRpdHlQb29sSWQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmlkZW50aXR5UG9vbC5pZGVudGl0eVBvb2xJZDtcbiAgICB9XG5cbiAgICBjb25zdHJ1Y3RvcihwYXJlbnQ6IENvbnN0cnVjdCwgbmFtZTogc3RyaW5nLCBwcm9wczogSVBhcmFtZXRlckF3YXJlUHJvcHMpIHtcbiAgICAgICAgc3VwZXIocGFyZW50LCBuYW1lLCBwcm9wcyk7XG4gICAgICAgIHRoaXMudXNlclBvb2wgPSB7XG4gICAgICAgICAgICB1c2VyUG9vbElkIDogJycsXG4gICAgICAgICAgICB1c2VyUG9vbFVybCA6ICcnLFxuICAgICAgICAgICAgdXNlclBvb2xBcm4gOiAnJyxcbiAgICAgICAgICAgIHVzZXJQb29sUHJvdmlkZXJOYW1lIDogJycsXG4gICAgICAgICAgICB1c2VyUG9vbE5hbWUgOiAnJywgICAgICAgXG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5jcmVhdFBvc3RSZWdpc3RyYXRpb25MYW1iZGFUcmlnZ2VyKCk7XG4gICAgICAgIHRoaXMuY3JlYXRlVXNlclBvb2woKTtcbiAgICAgICAgdGhpcy5jcmVhdGVVc2VyUG9vbENsaWVudEFwcCgpO1xuICAgICAgICB0aGlzLmNyZWF0ZUlkZW50aXR5UG9vbCgpO1xuICAgICAgICB0aGlzLmNyZWF0ZVVzZXJQb29sR3JvdXBzKCk7XG4gICAgICAgIHRoaXMuY29uZmlndXJlSWRlbnRpdHlQb29sUm9sZXMoKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGNyZWF0ZVVzZXJQb29sKCkge1xuXG4gICAgICAgIGNvbnN0IENES05BTUVTUEFDRSA9ICdhYTU5NmNlZS00NTFiLTExZTktYjIxMC1kNjYzYmQ4NzNkOTMnO1xuICAgICAgICBsZXQgZ2VuRnVuY3Rpb25JZCA9IHRoaXMucHJvcGVydGllcy5nZXRBcHBSZWZOYW1lKCkrJ1NpbXBsZVVzZXJQb29sR2VuRm4nO1xuICAgICAgICBjb25zdCBnZW5lcmF0aW5nRnVuY3Rpb24gPSBuZXcgTGFtYmRhLlNpbmdsZXRvbkZ1bmN0aW9uKHRoaXMsIGdlbkZ1bmN0aW9uSWQsIHtcbiAgICAgICAgICAgICAgICAgLy8gVG8gYXZvaWQgY29sbGlzaW9ucyB3aGVuIHJ1bm5pbmcgdGhlIG9uIHRoZSBzYW1lIGVudmlyb25tZW50XG4gICAgICAgICAgICAgICAgIC8vIG1hbnkgdGltZXMsIHdlJ3JlIHVzaW5nIHV1aWR2MyB0byBzdGljayB0byBzb21lICdhbGVhdG9yeScgXG4gICAgICAgICAgICAgICAgIC8vIHV1aWQgcmVsYXRlZCB0byB0aGUgZ2VuRnVuY3Rpb25JZFxuICAgICAgICAgICAgICAgICB1dWlkIDogdXVpZHYzKGdlbkZ1bmN0aW9uSWQsQ0RLTkFNRVNQQUNFKVxuICAgICAgICAgICAgICAgICxjb2RlIDogbmV3IExhbWJkYS5Bc3NldENvZGUocGF0aC5qb2luKGxhbWJkYXNMb2NhdGlvbiwnc2ltcGxlVXNlclBvb2wnKSlcbiAgICAgICAgICAgICAgICAsZGVzY3JpcHRpb24gOiBcIkdlbmVyYXRlcyB0aGUgVXNlclBvb2wgdXNpbmcgY29uZmlndXJhdGlvbiBub3QgYXZhaWxhYmxlIG9uIENES1wiXG4gICAgICAgICAgICAgICAgLGhhbmRsZXIgOiAnaW5kZXguaGFuZGxlcidcbiAgICAgICAgICAgICAgICAsdGltZW91dCA6IDMwMFxuICAgICAgICAgICAgICAgICxydW50aW1lIDogTGFtYmRhLlJ1bnRpbWUuTm9kZUpTNjEwXG4gICAgICAgICAgIH0pO1xuICAgXG4gICAgICAgICAgIGdlbmVyYXRpbmdGdW5jdGlvbi5hZGRUb1JvbGVQb2xpY3koIG5ldyBJQU0uUG9saWN5U3RhdGVtZW50KClcbiAgICAgICAgICAgICAgIC5hbGxvdygpXG4gICAgICAgICAgICAgICAuYWRkQWN0aW9ucyhcbiAgICAgICAgICAgICAgICAgICBcImNvZ25pdG8taWRwOkRlbGV0ZVVzZXJQb29sXCIsXG4gICAgICAgICAgICAgICAgICAgXCJjb2duaXRvLWlkcDpDcmVhdGVVc2VyUG9vbFwiLFxuICAgICAgICAgICAgICAgICAgIFwiY29nbml0by1pZHA6VXBkYXRlVXNlclBvb2xcIixcbiAgICAgICAgICAgICAgICAgICBcImNvZ25pdG8taWRwOkNyZWF0ZVVzZXJQb29sRG9tYWluXCIsXG4gICAgICAgICAgICAgICAgICAgXCJjb2duaXRvLWlkcDpEZWxldGVVc2VyUG9vbERvbWFpblwiXG4gICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAuYWRkQWxsUmVzb3VyY2VzKClcbiAgICAgICAgICAgKTtcbiAgIFxuICAgICAgICAgICB0aGlzLnNpbXBsZVVzZXJQb29sID0gbmV3IENmbi5DdXN0b21SZXNvdXJjZSh0aGlzLCB0aGlzLnByb3BlcnRpZXMuZ2V0QXBwUmVmTmFtZSgpKydTaW1wbGVVc2VyUG9vbEN1c3RvbVJlc291cmNlJyx7XG4gICAgICAgICAgICAgICAgbGFtYmRhUHJvdmlkZXIgOiBnZW5lcmF0aW5nRnVuY3Rpb25cbiAgICAgICAgICAgICAgICwgcHJvcGVydGllcyA6IHtcbiAgICAgICAgICAgICAgICAgICBBcHBOYW1lIDogdGhpcy5wcm9wZXJ0aWVzLmdldEFwcFJlZk5hbWUoKSxcbiAgICAgICAgICAgICAgICAgICBVc2VyUG9vbE5hbWUgOiB0aGlzLnByb3BlcnRpZXMuZ2V0QXBwUmVmTmFtZSgpLFxuICAgICAgICAgICAgICAgICAgIFBvc3RDb25maXJtYXRpb25MYW1iZGFBcm4gOiB0aGlzLnBvc3RSZWdpc3RyYXRpb25UcmlnZ2VyRnVuY3Rpb24uZnVuY3Rpb25Bcm5cbiAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgfSk7XG4gICBcbiAgICAgICAgICAgdGhpcy51c2VyUG9vbC51c2VyUG9vbElkID0gdGhpcy5zaW1wbGVVc2VyUG9vbC5nZXRBdHQoJ1VzZXJQb29sSWQnKS50b1N0cmluZygpO1xuICAgICAgICAgICB0aGlzLnVzZXJQb29sLnVzZXJQb29sQXJuID0gdGhpcy5zaW1wbGVVc2VyUG9vbC5nZXRBdHQoJ1VzZXJQb29sQXJuJykudG9TdHJpbmcoKTtcbiAgICAgICAgICAgdGhpcy51c2VyUG9vbC51c2VyUG9vbFByb3ZpZGVyTmFtZSA9IHRoaXMuc2ltcGxlVXNlclBvb2wuZ2V0QXR0KCdVc2VyUG9vbFByb3ZpZGVyTmFtZScpLnRvU3RyaW5nKCk7XG4gICAgICAgICAgIHRoaXMudXNlclBvb2wudXNlclBvb2xOYW1lID0gdGhpcy5zaW1wbGVVc2VyUG9vbC5nZXRBdHQoJ1VzZXJQb29sTmFtZScpLnRvU3RyaW5nKCk7XG5cbiAgICAgICAgICAgLy8gR2l2ZXMgcGVybWlzc2lvbiBmb3IgdXNlcnBvb2wgdG8gY2FsbCB0aGUgbGFtYmRhIHRyaWdnZXJcbiAgICAgICAgICAgbmV3IExhbWJkYS5DZm5QZXJtaXNzaW9uKHRoaXMsIHRoaXMucHJvcGVydGllcy5nZXRBcHBSZWZOYW1lKCkrJ1VzZXJQb29sUGVybScsIHtcbiAgICAgICAgICAgICAgICBhY3Rpb24gOiAnbGFtYmRhOmludm9rZUZ1bmN0aW9uJ1xuICAgICAgICAgICAgICAgLHByaW5jaXBhbCA6ICdjb2duaXRvLWlkcC5hbWF6b25hd3MuY29tJ1xuICAgICAgICAgICAgICAgLGZ1bmN0aW9uTmFtZSA6IHRoaXMucG9zdFJlZ2lzdHJhdGlvblRyaWdnZXJGdW5jdGlvbi5mdW5jdGlvbk5hbWVcbiAgICAgICAgICAgICAgICxzb3VyY2VBcm4gOiB0aGlzLnVzZXJQb29sLnVzZXJQb29sQXJuXG4gICAgICAgICAgIH0pXG5cbiAgICAgICAgbGV0IHBvbGljeSA9IG5ldyBJQU0uUG9saWN5KHRoaXMsdGhpcy5wcm9wZXJ0aWVzLmdldEFwcFJlZk5hbWUoKSsnVHJpZ2dlckZ1bmN0aW9uUG9saWN5Jyx7XG4gICAgICAgICAgICBwb2xpY3lOYW1lIDogJ0FsbG93QWRkVXNlclRvR3JvdXAnXG4gICAgICAgIH0pO1xuXG4gICAgICAgIHBvbGljeS5hZGRTdGF0ZW1lbnQoXG4gICAgICAgICAgICBuZXcgSUFNLlBvbGljeVN0YXRlbWVudCgpXG4gICAgICAgICAgICAgICAgLmFsbG93KClcbiAgICAgICAgICAgICAgICAuYWRkUmVzb3VyY2UodGhpcy51c2VyUG9vbC51c2VyUG9vbEFybilcbiAgICAgICAgICAgICAgICAuYWRkQWN0aW9uKCdjb2duaXRvLWlkcDpBZG1pbkFkZFVzZXJUb0dyb3VwJylcbiAgICAgICAgKVxuICAgICAgICB0aGlzLnBvc3RSZWdpc3RyYXRpb25UcmlnZ2VyRnVuY3Rpb25Sb2xlLmF0dGFjaElubGluZVBvbGljeShwb2xpY3kpO1xuXG4gICAgICAgIHRoaXMuYWRkUmVzb3VyY2UoJ3NlY3VyaXR5LnVzZXJwb29sJywgdGhpcy51c2VyUG9vbCk7XG4gICAgfVxuXG5cbiAgICBwcml2YXRlIGNyZWF0ZVVzZXJQb29sQ2xpZW50QXBwKCkge1xuICAgICAgICB0aGlzLnVzZXJQb29sQ2xpZW50ID0gbmV3IENvZ25pdG8uQ2ZuVXNlclBvb2xDbGllbnQodGhpcywgdGhpcy5wcm9wZXJ0aWVzLmdldEFwcFJlZk5hbWUoKSArICdBcHAnLCB7XG4gICAgICAgICAgICB1c2VyUG9vbElkOiB0aGlzLnVzZXJQb29sLnVzZXJQb29sSWQsXG4gICAgICAgICAgICBjbGllbnROYW1lOiB0aGlzLnByb3BlcnRpZXMuZ2V0QXBwUmVmTmFtZSgpICsgJ1dlYnNpdGUnLFxuICAgICAgICAgICAgZ2VuZXJhdGVTZWNyZXQ6IGZhbHNlLFxuICAgICAgICAgICAgZXhwbGljaXRBdXRoRmxvd3MgOiBbIFwiVVNFUl9QQVNTV09SRF9BVVRIXCIgXVxuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5hZGRSZXNvdXJjZSgnc2VjdXJpdHkudXNlcnBvb2xjbGllbnQnLCB0aGlzLnVzZXJQb29sQ2xpZW50KTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGNyZWF0ZUlkZW50aXR5UG9vbCgpIHtcbiAgICAgICAgdGhpcy5pZGVudGl0eVBvb2wgPSBuZXcgQ29nbml0by5DZm5JZGVudGl0eVBvb2wodGhpcywgdGhpcy5wcm9wZXJ0aWVzLmdldEFwcFJlZk5hbWUoKSArICdJZGVudGl0eVBvb2wnLCB7XG4gICAgICAgICAgICBpZGVudGl0eVBvb2xOYW1lOiB0aGlzLnByb3BlcnRpZXMuZ2V0QXBwUmVmTmFtZSgpLFxuICAgICAgICAgICAgYWxsb3dVbmF1dGhlbnRpY2F0ZWRJZGVudGl0aWVzOiBmYWxzZSxcbiAgICAgICAgICAgIGNvZ25pdG9JZGVudGl0eVByb3ZpZGVyczogW1xuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgY2xpZW50SWQ6IHRoaXMudXNlclBvb2xDbGllbnQudXNlclBvb2xDbGllbnRJZCxcbiAgICAgICAgICAgICAgICAgICAgcHJvdmlkZXJOYW1lOiB0aGlzLnVzZXJQb29sLnVzZXJQb29sUHJvdmlkZXJOYW1lLFxuICAgICAgICAgICAgICAgICAgICBzZXJ2ZXJTaWRlVG9rZW5DaGVjazogZmFsc2VcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICBdXG4gICAgICAgIH0pXG4gICAgICAgIHRoaXMuaWRlbnRpdHlQb29sLmFkZERlcGVuZHNPbih0aGlzLnNpbXBsZVVzZXJQb29sKTtcbiAgICAgICAgdGhpcy5hZGRSZXNvdXJjZSgnc2VjdXJpdHkuaWRlbnRpdHlwb29sJywgdGhpcy5pZGVudGl0eVBvb2wpO1xuICAgIH1cblxuICAgIHByaXZhdGUgY3JlYXRlVXNlclBvb2xHcm91cHMoKSB7XG4gICAgICAgIC8vIFBMQVlFUlNcbiAgICAgICAgdGhpcy5wbGF5ZXJzUm9sZSA9IG5ldyBJQU0uUm9sZSh0aGlzLCB0aGlzLnByb3BlcnRpZXMuZ2V0QXBwUmVmTmFtZSgpICsgJ1BsYXllcnNSb2xlJywge1xuICAgICAgICAgICAgcm9sZU5hbWUgOiB0aGlzLnByb3BlcnRpZXMuZ2V0QXBwUmVmTmFtZSgpICsgJ1BsYXllcnNSb2xlJyxcbiAgICAgICAgICAgIGFzc3VtZWRCeTogbmV3IElBTS5GZWRlcmF0ZWRQcmluY2lwYWwoJ2NvZ25pdG8taWRlbnRpdHkuYW1hem9uYXdzLmNvbScsIHtcbiAgICAgICAgICAgICAgICBcIlN0cmluZ0VxdWFsc1wiOiB7IFwiY29nbml0by1pZGVudGl0eS5hbWF6b25hd3MuY29tOmF1ZFwiOiB0aGlzLmlkZW50aXR5UG9vbC5pZGVudGl0eVBvb2xJZCB9LFxuICAgICAgICAgICAgICAgIFwiRm9yQW55VmFsdWU6U3RyaW5nTGlrZVwiOiB7IFwiY29nbml0by1pZGVudGl0eS5hbWF6b25hd3MuY29tOmFtclwiOiBcImF1dGhlbnRpY2F0ZWRcIiB9XG4gICAgICAgICAgICB9LFwic3RzOkFzc3VtZVJvbGVXaXRoV2ViSWRlbnRpdHlcIilcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMucGxheWVyc1JvbGUuYWRkVG9Qb2xpY3kobmV3IElBTS5Qb2xpY3lTdGF0ZW1lbnQoKVxuICAgICAgICAgICAgLmFsbG93KClcbiAgICAgICAgICAgIC5hZGRBY3Rpb24oXCJtb2JpbGVhbmFseXRpY3M6UHV0RXZlbnRzXCIpXG4gICAgICAgICAgICAuYWRkQWN0aW9uKFwiY29nbml0by1zeW5jOipcIilcbiAgICAgICAgICAgIC5hZGRBY3Rpb25zKFwiY29nbml0by1pZGVudGl0eToqXCIpXG4gICAgICAgICAgICAuYWRkQWxsUmVzb3VyY2VzKClcbiAgICAgICAgKTtcbiAgICAgICAgdGhpcy5hZGRSZXNvdXJjZSgnc2VjdXJpdHkucGxheWVyc3JvbGUnLHRoaXMucGxheWVyc1JvbGUpO1xuXG4gICAgICAgIG5ldyBDb2duaXRvLkNmblVzZXJQb29sR3JvdXAodGhpcywgdGhpcy5wcm9wZXJ0aWVzLmdldEFwcFJlZk5hbWUoKSArICdQbGF5ZXJzJywge1xuICAgICAgICAgICAgZ3JvdXBOYW1lOiAnUGxheWVycycsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1BsYXllcnMgb2YgdGhlIGdhbWUuJyxcbiAgICAgICAgICAgIHByZWNlZGVuY2U6IDk5OTksXG4gICAgICAgICAgICByb2xlQXJuOiB0aGlzLnBsYXllcnNSb2xlLnJvbGVBcm4sXG4gICAgICAgICAgICB1c2VyUG9vbElkOiB0aGlzLnVzZXJQb29sLnVzZXJQb29sSWRcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gTUFOQUdFUlNcbiAgICAgICAgdGhpcy5tYW5hZ2Vyc1JvbGUgPSBuZXcgSUFNLlJvbGUodGhpcywgdGhpcy5wcm9wZXJ0aWVzLmdldEFwcFJlZk5hbWUoKSArICdNYW5hZ2Vyc1JvbGUnLCB7XG4gICAgICAgICAgICByb2xlTmFtZSA6IHRoaXMucHJvcGVydGllcy5nZXRBcHBSZWZOYW1lKCkgKyAnTWFuYWdlcnNSb2xlJyxcbiAgICAgICAgICAgIGFzc3VtZWRCeTogbmV3IElBTS5GZWRlcmF0ZWRQcmluY2lwYWwoJ2NvZ25pdG8taWRlbnRpdHkuYW1hem9uYXdzLmNvbScsIHtcbiAgICAgICAgICAgICAgICBcIlN0cmluZ0VxdWFsc1wiOiB7IFwiY29nbml0by1pZGVudGl0eS5hbWF6b25hd3MuY29tOmF1ZFwiOiB0aGlzLmlkZW50aXR5UG9vbC5pZGVudGl0eVBvb2xJZCB9LFxuICAgICAgICAgICAgICAgIFwiRm9yQW55VmFsdWU6U3RyaW5nTGlrZVwiOiB7IFwiY29nbml0by1pZGVudGl0eS5hbWF6b25hd3MuY29tOmFtclwiOiBcImF1dGhlbnRpY2F0ZWRcIiB9XG4gICAgICAgICAgICB9LFwic3RzOkFzc3VtZVJvbGVXaXRoV2ViSWRlbnRpdHlcIilcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMubWFuYWdlcnNSb2xlLmF0dGFjaE1hbmFnZWRQb2xpY3koJ2Fybjphd3M6aWFtOjphd3M6cG9saWN5L0FtYXpvbkNvZ25pdG9Qb3dlclVzZXInKTtcbiAgICAgICAgdGhpcy5tYW5hZ2Vyc1JvbGUuYWRkVG9Qb2xpY3kobmV3IElBTS5Qb2xpY3lTdGF0ZW1lbnQoKVxuICAgICAgICAgICAgLmFsbG93KClcbiAgICAgICAgICAgIC5hZGRBY3Rpb24oXCJtb2JpbGVhbmFseXRpY3M6UHV0RXZlbnRzXCIpXG4gICAgICAgICAgICAuYWRkQWN0aW9uKFwiY29nbml0by1zeW5jOipcIilcbiAgICAgICAgICAgIC5hZGRBY3Rpb25zKFwiY29nbml0by1pZGVudGl0eToqXCIpXG4gICAgICAgICAgICAuYWRkQWxsUmVzb3VyY2VzKClcbiAgICAgICAgKTtcbiAgICAgICAgdGhpcy5hZGRSZXNvdXJjZSgnc2VjdXJpdHkubWFuYWdlcnNyb2xlJyx0aGlzLm1hbmFnZXJzUm9sZSk7XG4gICAgICAgIG5ldyBDb2duaXRvLkNmblVzZXJQb29sR3JvdXAodGhpcywgdGhpcy5wcm9wZXJ0aWVzLmdldEFwcFJlZk5hbWUoKSArICdNYW5hZ2VycycsIHtcbiAgICAgICAgICAgIGdyb3VwTmFtZTogJ01hbmFnZXJzJyxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnTWFuYWdlcnMgb2YgdGhlIGdhbWUuJyxcbiAgICAgICAgICAgIHByZWNlZGVuY2U6IDAsXG4gICAgICAgICAgICByb2xlQXJuOiB0aGlzLm1hbmFnZXJzUm9sZS5yb2xlQXJuLFxuICAgICAgICAgICAgdXNlclBvb2xJZDogdGhpcy51c2VyUG9vbC51c2VyUG9vbElkXG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIHByaXZhdGUgY29uZmlndXJlSWRlbnRpdHlQb29sUm9sZXMoKSB7XG4gICAgICAgIHRoaXMudW5hdXRoZW50aWNhdGVkUm9sZSA9IG5ldyBJQU0uUm9sZSh0aGlzLCB0aGlzLnByb3BlcnRpZXMuZ2V0QXBwUmVmTmFtZSgpICsgJ1VuYXV0aFJvbGUnLCB7XG4gICAgICAgICAgICByb2xlTmFtZSA6IHRoaXMucHJvcGVydGllcy5nZXRBcHBSZWZOYW1lKCkgKyAnVW5hdXRoUm9sZScsXG4gICAgICAgICAgICBhc3N1bWVkQnk6IG5ldyBJQU0uRmVkZXJhdGVkUHJpbmNpcGFsKCdjb2duaXRvLWlkZW50aXR5LmFtYXpvbmF3cy5jb20nLCB7XG4gICAgICAgICAgICAgICAgXCJTdHJpbmdFcXVhbHNcIjogeyBcImNvZ25pdG8taWRlbnRpdHkuYW1hem9uYXdzLmNvbTphdWRcIjogdGhpcy5pZGVudGl0eVBvb2wuaWRlbnRpdHlQb29sSWQgfSxcbiAgICAgICAgICAgICAgICBcIkZvckFueVZhbHVlOlN0cmluZ0xpa2VcIjogeyBcImNvZ25pdG8taWRlbnRpdHkuYW1hem9uYXdzLmNvbTphbXJcIjogXCJ1bmF1dGhlbnRpY2F0ZWRcIiB9XG4gICAgICAgICAgICB9KVxuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy51bmF1dGhlbnRpY2F0ZWRSb2xlLmFkZFRvUG9saWN5KG5ldyBJQU0uUG9saWN5U3RhdGVtZW50KClcbiAgICAgICAgICAgIC5hbGxvdygpXG4gICAgICAgICAgICAuYWRkQWN0aW9uKFwibW9iaWxlYW5hbHl0aWNzOlB1dEV2ZW50c1wiKVxuICAgICAgICAgICAgLmFkZEFjdGlvbihcImNvZ25pdG8tc3luYzoqXCIpXG4gICAgICAgICAgICAuYWRkQWN0aW9ucyhcImNvZ25pdG8taWRlbnRpdHk6KlwiKVxuICAgICAgICAgICAgLmFkZEFsbFJlc291cmNlcygpXG4gICAgICAgICk7IFxuICAgICAgICBcblxuICAgICAgICBuZXcgQ29nbml0by5DZm5JZGVudGl0eVBvb2xSb2xlQXR0YWNobWVudCh0aGlzLCB0aGlzLnByb3BlcnRpZXMuZ2V0QXBwUmVmTmFtZSgpICsgXCJJRFBSb2xlc1wiLFxuICAgICAgICB7XG4gICAgICAgICAgICBpZGVudGl0eVBvb2xJZCA6IHRoaXMuaWRlbnRpdHlQb29sLmlkZW50aXR5UG9vbElkXG4gICAgICAgICAgICxyb2xlcyA6IHtcbiAgICAgICAgICAgICAgIGF1dGhlbnRpY2F0ZWQgOiB0aGlzLnBsYXllcnNSb2xlLnJvbGVBcm4sXG4gICAgICAgICAgICAgICB1bmF1dGhlbnRpY2F0ZWQgOiB0aGlzLnVuYXV0aGVudGljYXRlZFJvbGUucm9sZUFyblxuICAgICAgICAgICB9XG4gICAgICAgICAgIC8vIFRPLURPIElkZW50aWZ5IHdpdGggdGhlIHRlYW0gZnJvbSBDREsgaG93IHRvIGltcGxlbWVudCB0aGlzXG4gICAgICAgLyogICAgLHJvbGVNYXBwaW5ncyA6IHtcbiAgICAgICAgICAgICAgIHR5cGU6IFwiUnVsZXNcIixcbiAgICAgICAgICAgICAgIGFtYmlndW91c1JvbGVSZXNvbHV0aW9uOiBcIkRlbnlcIixcbiAgICAgICAgICAgICAgIHJ1bGVzQ29uZmlndXJhdGlvbjoge1xuICAgICAgICAgICAgICAgICAgIHJ1bGVzOiBbXG4gICAgICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgIGNsYWltOiBcImNvZ25pdG86cHJlZmVycmVkX3JvbGVcIixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgIG1hdGNoVHlwZTogXCJDb250YWluc1wiLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWU6IFwiTWFuYWdlcnNcIixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgIHJvbGVBcm46IHRoaXMubWFuYWdlcnNSb2xlXG4gICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgIGNsYWltOiBcImNvZ25pdG86cHJlZmVycmVkX3JvbGVcIixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgIG1hdGNoVHlwZTogXCJDb250YWluc1wiLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWU6IFwiUGxheWVyc1wiLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgcm9sZUFybjogdGhpcy5wbGF5ZXJzUm9sZVxuICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgfVxuICAgICAgICAgICB9XG4gICAgICAgICAgICovXG4gICAgICAgfSk7XG5cbiAgICB9XG5cbiAgICBwcml2YXRlIGNyZWF0UG9zdFJlZ2lzdHJhdGlvbkxhbWJkYVRyaWdnZXIoKSB7XG5cbiAgICAgICAgdGhpcy5wb3N0UmVnaXN0cmF0aW9uVHJpZ2dlckZ1bmN0aW9uUm9sZSA9IG5ldyBJQU0uUm9sZSh0aGlzLCB0aGlzLnByb3BlcnRpZXMuZ2V0QXBwUmVmTmFtZSgpICsgJ1Bvc3RSZWdpc3RyYXRpb25Gbl9Sb2xlJywge1xuICAgICAgICAgICAgcm9sZU5hbWU6IHRoaXMucHJvcGVydGllcy5nZXRBcHBSZWZOYW1lKCkgKyAnUG9zdFJlZ2lzdHJhdGlvbkZuX1JvbGUnXG4gICAgICAgICAgICAsIGFzc3VtZWRCeTogbmV3IElBTS5TZXJ2aWNlUHJpbmNpcGFsKCdsYW1iZGEuYW1hem9uYXdzLmNvbScpXG4gICAgICAgICAgICAsIG1hbmFnZWRQb2xpY3lBcm5zOiBbJ2Fybjphd3M6aWFtOjphd3M6cG9saWN5L3NlcnZpY2Utcm9sZS9BV1NMYW1iZGFCYXNpY0V4ZWN1dGlvblJvbGUnXVxuICAgICAgICB9KTtcbiAgICAgICAgXG4gICAgICAgIHRoaXMucG9zdFJlZ2lzdHJhdGlvblRyaWdnZXJGdW5jdGlvbiA9XG4gICAgICAgICAgICBuZXcgTGFtYmRhLkZ1bmN0aW9uKHRoaXMsIHRoaXMucHJvcGVydGllcy5nZXRBcHBSZWZOYW1lKCkgKyAnUG9zdFJlZ2lzdHJhdGlvbicsIHtcbiAgICAgICAgICAgICAgICBydW50aW1lOiBMYW1iZGEuUnVudGltZS5Ob2RlSlM4MTAsXG4gICAgICAgICAgICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxuICAgICAgICAgICAgICAgIGNvZGU6IExhbWJkYS5Db2RlLmFzc2V0KHBhdGguam9pbihsYW1iZGFzTG9jYXRpb24sJ3Bvc3RSZWdpc3RyYXRpb24nKSlcbiAgICAgICAgICAgICAgICAsIGZ1bmN0aW9uTmFtZTogdGhpcy5wcm9wZXJ0aWVzLmdldEFwcFJlZk5hbWUoKSArICdQb3N0UmVnaXN0cmF0aW9uRm4nXG4gICAgICAgICAgICAgICAgLCBkZXNjcmlwdGlvbjogJ1RoaXMgZnVuY3Rpb24gYWRkcyBhbiB1c2VyIHRvIHRoZSBQbGF5ZXJzIGdyb3VwIGFmdGVyIGNvbmZpcm1hdGlvbidcbiAgICAgICAgICAgICAgICAsIG1lbW9yeVNpemU6IDEyOFxuICAgICAgICAgICAgICAgICwgdGltZW91dDogNjBcbiAgICAgICAgICAgICAgICAsIHJvbGU6IHRoaXMucG9zdFJlZ2lzdHJhdGlvblRyaWdnZXJGdW5jdGlvblJvbGUgXG4gICAgICAgICAgICB9KTtcbiAgICB9XG5cbn0iXX0=