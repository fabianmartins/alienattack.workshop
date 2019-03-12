"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const resourceawarestack_1 = require("./../resourceawarestack");
const Cognito = require("@aws-cdk/aws-cognito");
const IAM = require("@aws-cdk/aws-iam");
const Lambda = require("@aws-cdk/aws-lambda");
const Cfn = require("@aws-cdk/aws-cloudformation");
const lambdasLocation = './lambdas/';
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
        const generatingFunction = new Lambda.SingletonFunction(this, 'SimpleUserPoolGenFn', {
            uuid: '81066468-403f-11e9-b210-d663bd873d93',
            code: new Lambda.AssetCode(lambdasLocation + 'simpleUserPool'),
            description: "Generates the UserPool using configuration not available on CDK",
            handler: 'index.handler',
            timeout: 300,
            runtime: Lambda.Runtime.NodeJS610
        });
        generatingFunction.addToRolePolicy(new IAM.PolicyStatement()
            .allow()
            .addActions("cognito-idp:DeleteUserPool", "cognito-idp:CreateUserPool", "cognito-idp:UpdateUserPool", "cognito-idp:CreateUserPoolDomain", "cognito-idp:DeleteUserPoolDomain")
            .addAllResources());
        this.simpleUserPool = new Cfn.CustomResource(this, 'SimpleUserPoolCustomResource', {
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
                code: Lambda.Code.asset(lambdasLocation + 'postregistration'),
                functionName: this.properties.getAppRefName() + 'PostRegistrationFn',
                description: 'This function adds an user to the Players group after confirmation',
                memorySize: 128,
                timeout: 60,
                role: this.postRegistrationTriggerFunctionRole
            });
    }
}
exports.SecurityLayer = SecurityLayer;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VjdXJpdHlMYXllci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInNlY3VyaXR5TGF5ZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFDQSxnRUFBc0Y7QUFHdEYsZ0RBQWlEO0FBQ2pELHdDQUF5QztBQUN6Qyw4Q0FBK0M7QUFDL0MsbURBQW9EO0FBRXBELE1BQU0sZUFBZSxHQUFHLFlBQVksQ0FBQztBQVVyQyxNQUFhLGFBQWMsU0FBUSwyQ0FBc0I7SUFhckQsYUFBYTtRQUNULE9BQU8sSUFBSSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUM7SUFDcEMsQ0FBQztJQUVELGNBQWM7UUFDVixJQUFJLEtBQUssR0FBRyxjQUFjLEdBQVksSUFBSSxDQUFDLFVBQVUsQ0FBQyxNQUFPLEdBQUcsaUJBQWlCLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUM7UUFDN0csT0FBTyxLQUFLLENBQUM7SUFDakIsQ0FBQztJQUdELGNBQWM7UUFDVixPQUFPLElBQUksQ0FBQyxRQUFRLENBQUMsV0FBVyxDQUFBO0lBQ3BDLENBQUM7SUFFRCxpQkFBaUI7UUFDYixPQUFPLElBQUksQ0FBQyxjQUFjLENBQUM7SUFDL0IsQ0FBQztJQUVELG1CQUFtQjtRQUNmLE9BQU8sSUFBSSxDQUFDLGNBQWMsQ0FBQyxnQkFBZ0IsQ0FBQztJQUNoRCxDQUFDO0lBRUQsZUFBZTtRQUNYLE9BQU8sSUFBSSxDQUFDLFlBQVksQ0FBQTtJQUM1QixDQUFDO0lBRUQsaUJBQWlCO1FBQ2IsT0FBTyxJQUFJLENBQUMsWUFBWSxDQUFDLGNBQWMsQ0FBQztJQUM1QyxDQUFDO0lBRUQsWUFBWSxNQUFpQixFQUFFLElBQVksRUFBRSxLQUEyQjtRQUNwRSxLQUFLLENBQUMsTUFBTSxFQUFFLElBQUksRUFBRSxLQUFLLENBQUMsQ0FBQztRQUMzQixJQUFJLENBQUMsUUFBUSxHQUFHO1lBQ1osVUFBVSxFQUFHLEVBQUU7WUFDZixXQUFXLEVBQUcsRUFBRTtZQUNoQixXQUFXLEVB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QztDQUVKO0FBOVFELHNDQThRQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ0Bhd3MtY2RrL2Nkayc7XG5pbXBvcnQgeyBSZXNvdXJjZUF3YXJlQ29uc3RydWN0LCBJUGFyYW1ldGVyQXdhcmVQcm9wcyB9IGZyb20gJy4vLi4vcmVzb3VyY2Vhd2FyZXN0YWNrJ1xuXG5cbmltcG9ydCBDb2duaXRvID0gcmVxdWlyZSgnQGF3cy1jZGsvYXdzLWNvZ25pdG8nKTtcbmltcG9ydCBJQU0gPSByZXF1aXJlKCdAYXdzLWNkay9hd3MtaWFtJyk7XG5pbXBvcnQgTGFtYmRhID0gcmVxdWlyZSgnQGF3cy1jZGsvYXdzLWxhbWJkYScpO1xuaW1wb3J0IENmbiA9IHJlcXVpcmUoJ0Bhd3MtY2RrL2F3cy1jbG91ZGZvcm1hdGlvbicpO1xuXG5jb25zdCBsYW1iZGFzTG9jYXRpb24gPSAnLi9sYW1iZGFzLyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgU2ltcGxlVXNlclBvb2wge1xuICAgIHVzZXJQb29sSWQgOiBzdHJpbmcsXG4gICAgdXNlclBvb2xVcmwgOiBzdHJpbmcsXG4gICAgdXNlclBvb2xBcm4gOiBzdHJpbmcsXG4gICAgdXNlclBvb2xQcm92aWRlck5hbWUgOiBzdHJpbmcsXG4gICAgdXNlclBvb2xOYW1lIDogc3RyaW5nXG59XG5cbmV4cG9ydCBjbGFzcyBTZWN1cml0eUxheWVyIGV4dGVuZHMgUmVzb3VyY2VBd2FyZUNvbnN0cnVjdCB7XG5cbiAgICB1c2VyUG9vbDogU2ltcGxlVXNlclBvb2w7XG4gICAgc2ltcGxlVXNlclBvb2wgOiBDZm4uQ3VzdG9tUmVzb3VyY2U7XG4gICAgaWRlbnRpdHlQb29sOiBDb2duaXRvLkNmbklkZW50aXR5UG9vbDtcbiAgICB1c2VyUG9vbENsaWVudDogQ29nbml0by5DZm5Vc2VyUG9vbENsaWVudDtcbiAgICBwbGF5ZXJzUm9sZTogSUFNLlJvbGU7XG4gICAgbWFuYWdlcnNSb2xlOiBJQU0uUm9sZTtcbiAgICB1bmF1dGhlbnRpY2F0ZWRSb2xlOiBJQU0uUm9sZTtcbiAgICBwb3N0UmVnaXN0cmF0aW9uVHJpZ2dlckZ1bmN0aW9uIDogTGFtYmRhLkZ1bmN0aW9uO1xuICAgIHBvc3RSZWdpc3RyYXRpb25UcmlnZ2VyRnVuY3Rpb25Sb2xlIDogSUFNLlJvbGU7XG4gICAgXG5cbiAgICBnZXRVc2VyUG9vbElkKCkge1xuICAgICAgICByZXR1cm4gdGhpcy51c2VyUG9vbC51c2VyUG9vbElkO1xuICAgIH1cblxuICAgIGdldFVzZXJQb29sVXJsKCkge1xuICAgICAgICBsZXQgdmFsdWUgPSBcImNvZ25pdG8taWRwLlwiICsgKDxzdHJpbmc+dGhpcy5wcm9wZXJ0aWVzLnJlZ2lvbikgKyBcIi5hbWF6b25hd3MuY29tL1wiICsgdGhpcy51c2VyUG9vbC51c2VyUG9vbElkO1xuICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgfVxuXG5cbiAgICBnZXRVc2VyUG9vbEFybigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMudXNlclBvb2wudXNlclBvb2xBcm5cbiAgICB9XG5cbiAgICBnZXRVc2VyUG9vbENsaWVudCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMudXNlclBvb2xDbGllbnQ7XG4gICAgfVxuXG4gICAgZ2V0VXNlclBvb2xDbGllbnRJZCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMudXNlclBvb2xDbGllbnQudXNlclBvb2xDbGllbnRJZDtcbiAgICB9XG5cbiAgICBnZXRJZGVudGl0eVBvb2woKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmlkZW50aXR5UG9vbFxuICAgIH1cblxuICAgIGdldElkZW50aXR5UG9vbElkKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5pZGVudGl0eVBvb2wuaWRlbnRpdHlQb29sSWQ7XG4gICAgfVxuXG4gICAgY29uc3RydWN0b3IocGFyZW50OiBDb25zdHJ1Y3QsIG5hbWU6IHN0cmluZywgcHJvcHM6IElQYXJhbWV0ZXJBd2FyZVByb3BzKSB7XG4gICAgICAgIHN1cGVyKHBhcmVudCwgbmFtZSwgcHJvcHMpO1xuICAgICAgICB0aGlzLnVzZXJQb29sID0ge1xuICAgICAgICAgICAgdXNlclBvb2xJZCA6ICcnLFxuICAgICAgICAgICAgdXNlclBvb2xVcmwgOiAnJyxcbiAgICAgICAgICAgIHVzZXJQb29sQXJuIDogJycsXG4gICAgICAgICAgICB1c2VyUG9vbFByb3ZpZGVyTmFtZSA6ICcnLFxuICAgICAgICAgICAgdXNlclBvb2xOYW1lIDogJycsICAgICAgIFxuICAgICAgICB9XG4gICAgICAgIHRoaXMuY3JlYXRQb3N0UmVnaXN0cmF0aW9uTGFtYmRhVHJpZ2dlcigpO1xuICAgICAgICB0aGlzLmNyZWF0ZVVzZXJQb29sKCk7XG4gICAgICAgIHRoaXMuY3JlYXRlVXNlclBvb2xDbGllbnRBcHAoKTtcbiAgICAgICAgdGhpcy5jcmVhdGVJZGVudGl0eVBvb2woKTtcbiAgICAgICAgdGhpcy5jcmVhdGVVc2VyUG9vbEdyb3VwcygpO1xuICAgICAgICB0aGlzLmNvbmZpZ3VyZUlkZW50aXR5UG9vbFJvbGVzKCk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBjcmVhdGVVc2VyUG9vbCgpIHtcblxuICAgICAgICBjb25zdCBnZW5lcmF0aW5nRnVuY3Rpb24gPSBuZXcgTGFtYmRhLlNpbmdsZXRvbkZ1bmN0aW9uKHRoaXMsICdTaW1wbGVVc2VyUG9vbEdlbkZuJywge1xuICAgICAgICAgICAgICAgIHV1aWQgOiAnODEwNjY0NjgtNDAzZi0xMWU5LWIyMTAtZDY2M2JkODczZDkzJ1xuICAgICAgICAgICAgICAgLGNvZGUgOiBuZXcgTGFtYmRhLkFzc2V0Q29kZShsYW1iZGFzTG9jYXRpb24gKyAnc2ltcGxlVXNlclBvb2wnKVxuICAgICAgICAgICAgICAgLGRlc2NyaXB0aW9uIDogXCJHZW5lcmF0ZXMgdGhlIFVzZXJQb29sIHVzaW5nIGNvbmZpZ3VyYXRpb24gbm90IGF2YWlsYWJsZSBvbiBDREtcIlxuICAgICAgICAgICAgICAgLGhhbmRsZXIgOiAnaW5kZXguaGFuZGxlcidcbiAgICAgICAgICAgICAgICx0aW1lb3V0IDogMzAwXG4gICAgICAgICAgICAgICAscnVudGltZSA6IExhbWJkYS5SdW50aW1lLk5vZGVKUzYxMFxuICAgICAgICAgICB9KTtcbiAgIFxuICAgICAgICAgICBnZW5lcmF0aW5nRnVuY3Rpb24uYWRkVG9Sb2xlUG9saWN5KCBuZXcgSUFNLlBvbGljeVN0YXRlbWVudCgpXG4gICAgICAgICAgICAgICAuYWxsb3coKVxuICAgICAgICAgICAgICAgLmFkZEFjdGlvbnMoXG4gICAgICAgICAgICAgICAgICAgXCJjb2duaXRvLWlkcDpEZWxldGVVc2VyUG9vbFwiLFxuICAgICAgICAgICAgICAgICAgIFwiY29nbml0by1pZHA6Q3JlYXRlVXNlclBvb2xcIixcbiAgICAgICAgICAgICAgICAgICBcImNvZ25pdG8taWRwOlVwZGF0ZVVzZXJQb29sXCIsXG4gICAgICAgICAgICAgICAgICAgXCJjb2duaXRvLWlkcDpDcmVhdGVVc2VyUG9vbERvbWFpblwiLFxuICAgICAgICAgICAgICAgICAgIFwiY29nbml0by1pZHA6RGVsZXRlVXNlclBvb2xEb21haW5cIlxuICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICAgLmFkZEFsbFJlc291cmNlcygpXG4gICAgICAgICAgICk7XG4gICBcbiAgICAgICAgICAgdGhpcy5zaW1wbGVVc2VyUG9vbCA9IG5ldyBDZm4uQ3VzdG9tUmVzb3VyY2UodGhpcywgJ1NpbXBsZVVzZXJQb29sQ3VzdG9tUmVzb3VyY2UnLHtcbiAgICAgICAgICAgICAgICBsYW1iZGFQcm92aWRlciA6IGdlbmVyYXRpbmdGdW5jdGlvblxuICAgICAgICAgICAgICAgLCBwcm9wZXJ0aWVzIDoge1xuICAgICAgICAgICAgICAgICAgIEFwcE5hbWUgOiB0aGlzLnByb3BlcnRpZXMuZ2V0QXBwUmVmTmFtZSgpLFxuICAgICAgICAgICAgICAgICAgIFVzZXJQb29sTmFtZSA6IHRoaXMucHJvcGVydGllcy5nZXRBcHBSZWZOYW1lKCksXG4gICAgICAgICAgICAgICAgICAgUG9zdENvbmZpcm1hdGlvbkxhbWJkYUFybiA6IHRoaXMucG9zdFJlZ2lzdHJhdGlvblRyaWdnZXJGdW5jdGlvbi5mdW5jdGlvbkFyblxuICAgICAgICAgICAgICAgfVxuICAgICAgICAgICB9KTtcbiAgIFxuICAgICAgICAgICB0aGlzLnVzZXJQb29sLnVzZXJQb29sSWQgPSB0aGlzLnNpbXBsZVVzZXJQb29sLmdldEF0dCgnVXNlclBvb2xJZCcpLnRvU3RyaW5nKCk7XG4gICAgICAgICAgIHRoaXMudXNlclBvb2wudXNlclBvb2xBcm4gPSB0aGlzLnNpbXBsZVVzZXJQb29sLmdldEF0dCgnVXNlclBvb2xBcm4nKS50b1N0cmluZygpO1xuICAgICAgICAgICB0aGlzLnVzZXJQb29sLnVzZXJQb29sUHJvdmlkZXJOYW1lID0gdGhpcy5zaW1wbGVVc2VyUG9vbC5nZXRBdHQoJ1VzZXJQb29sUHJvdmlkZXJOYW1lJykudG9TdHJpbmcoKTtcbiAgICAgICAgICAgdGhpcy51c2VyUG9vbC51c2VyUG9vbE5hbWUgPSB0aGlzLnNpbXBsZVVzZXJQb29sLmdldEF0dCgnVXNlclBvb2xOYW1lJykudG9TdHJpbmcoKTtcblxuICAgICAgICAgICAvLyBHaXZlcyBwZXJtaXNzaW9uIGZvciB1c2VycG9vbCB0byBjYWxsIHRoZSBsYW1iZGEgdHJpZ2dlclxuICAgICAgICAgICBuZXcgTGFtYmRhLkNmblBlcm1pc3Npb24odGhpcywgdGhpcy5wcm9wZXJ0aWVzLmdldEFwcFJlZk5hbWUoKSsnVXNlclBvb2xQZXJtJywge1xuICAgICAgICAgICAgICAgIGFjdGlvbiA6ICdsYW1iZGE6aW52b2tlRnVuY3Rpb24nXG4gICAgICAgICAgICAgICAscHJpbmNpcGFsIDogJ2NvZ25pdG8taWRwLmFtYXpvbmF3cy5jb20nXG4gICAgICAgICAgICAgICAsZnVuY3Rpb25OYW1lIDogdGhpcy5wb3N0UmVnaXN0cmF0aW9uVHJpZ2dlckZ1bmN0aW9uLmZ1bmN0aW9uTmFtZVxuICAgICAgICAgICAgICAgLHNvdXJjZUFybiA6IHRoaXMudXNlclBvb2wudXNlclBvb2xBcm5cbiAgICAgICAgICAgfSlcblxuICAgICAgICBsZXQgcG9saWN5ID0gbmV3IElBTS5Qb2xpY3kodGhpcyx0aGlzLnByb3BlcnRpZXMuZ2V0QXBwUmVmTmFtZSgpKydUcmlnZ2VyRnVuY3Rpb25Qb2xpY3knLHtcbiAgICAgICAgICAgIHBvbGljeU5hbWUgOiAnQWxsb3dBZGRVc2VyVG9Hcm91cCdcbiAgICAgICAgfSk7XG5cbiAgICAgICAgcG9saWN5LmFkZFN0YXRlbWVudChcbiAgICAgICAgICAgIG5ldyBJQU0uUG9saWN5U3RhdGVtZW50KClcbiAgICAgICAgICAgICAgICAuYWxsb3coKVxuICAgICAgICAgICAgICAgIC5hZGRSZXNvdXJjZSh0aGlzLnVzZXJQb29sLnVzZXJQb29sQXJuKVxuICAgICAgICAgICAgICAgIC5hZGRBY3Rpb24oJ2NvZ25pdG8taWRwOkFkbWluQWRkVXNlclRvR3JvdXAnKVxuICAgICAgICApXG4gICAgICAgIHRoaXMucG9zdFJlZ2lzdHJhdGlvblRyaWdnZXJGdW5jdGlvblJvbGUuYXR0YWNoSW5saW5lUG9saWN5KHBvbGljeSk7XG5cbiAgICAgICAgdGhpcy5hZGRSZXNvdXJjZSgnc2VjdXJpdHkudXNlcnBvb2wnLCB0aGlzLnVzZXJQb29sKTtcbiAgICB9XG5cblxuICAgIHByaXZhdGUgY3JlYXRlVXNlclBvb2xDbGllbnRBcHAoKSB7XG4gICAgICAgIHRoaXMudXNlclBvb2xDbGllbnQgPSBuZXcgQ29nbml0by5DZm5Vc2VyUG9vbENsaWVudCh0aGlzLCB0aGlzLnByb3BlcnRpZXMuZ2V0QXBwUmVmTmFtZSgpICsgJ0FwcCcsIHtcbiAgICAgICAgICAgIHVzZXJQb29sSWQ6IHRoaXMudXNlclBvb2wudXNlclBvb2xJZCxcbiAgICAgICAgICAgIGNsaWVudE5hbWU6IHRoaXMucHJvcGVydGllcy5nZXRBcHBSZWZOYW1lKCkgKyAnV2Vic2l0ZScsXG4gICAgICAgICAgICBnZW5lcmF0ZVNlY3JldDogZmFsc2UsXG4gICAgICAgICAgICBleHBsaWNpdEF1dGhGbG93cyA6IFsgXCJVU0VSX1BBU1NXT1JEX0FVVEhcIiBdXG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLmFkZFJlc291cmNlKCdzZWN1cml0eS51c2VycG9vbGNsaWVudCcsIHRoaXMudXNlclBvb2xDbGllbnQpO1xuICAgIH1cblxuICAgIHByaXZhdGUgY3JlYXRlSWRlbnRpdHlQb29sKCkge1xuICAgICAgICB0aGlzLmlkZW50aXR5UG9vbCA9IG5ldyBDb2duaXRvLkNmbklkZW50aXR5UG9vbCh0aGlzLCB0aGlzLnByb3BlcnRpZXMuZ2V0QXBwUmVmTmFtZSgpICsgJ0lkZW50aXR5UG9vbCcsIHtcbiAgICAgICAgICAgIGlkZW50aXR5UG9vbE5hbWU6IHRoaXMucHJvcGVydGllcy5nZXRBcHBSZWZOYW1lKCksXG4gICAgICAgICAgICBhbGxvd1VuYXV0aGVudGljYXRlZElkZW50aXRpZXM6IGZhbHNlLFxuICAgICAgICAgICAgY29nbml0b0lkZW50aXR5UHJvdmlkZXJzOiBbXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBjbGllbnRJZDogdGhpcy51c2VyUG9vbENsaWVudC51c2VyUG9vbENsaWVudElkLFxuICAgICAgICAgICAgICAgICAgICBwcm92aWRlck5hbWU6IHRoaXMudXNlclBvb2wudXNlclBvb2xQcm92aWRlck5hbWUsXG4gICAgICAgICAgICAgICAgICAgIHNlcnZlclNpZGVUb2tlbkNoZWNrOiBmYWxzZVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIF1cbiAgICAgICAgfSlcbiAgICAgICAgdGhpcy5pZGVudGl0eVBvb2wuYWRkRGVwZW5kc09uKHRoaXMuc2ltcGxlVXNlclBvb2wpO1xuICAgICAgICB0aGlzLmFkZFJlc291cmNlKCdzZWN1cml0eS5pZGVudGl0eXBvb2wnLCB0aGlzLmlkZW50aXR5UG9vbCk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBjcmVhdGVVc2VyUG9vbEdyb3VwcygpIHtcbiAgICAgICAgLy8gUExBWUVSU1xuICAgICAgICB0aGlzLnBsYXllcnNSb2xlID0gbmV3IElBTS5Sb2xlKHRoaXMsIHRoaXMucHJvcGVydGllcy5nZXRBcHBSZWZOYW1lKCkgKyAnUGxheWVyc1JvbGUnLCB7XG4gICAgICAgICAgICByb2xlTmFtZSA6IHRoaXMucHJvcGVydGllcy5nZXRBcHBSZWZOYW1lKCkgKyAnUGxheWVyc1JvbGUnLFxuICAgICAgICAgICAgYXNzdW1lZEJ5OiBuZXcgSUFNLkZlZGVyYXRlZFByaW5jaXBhbCgnY29nbml0by1pZGVudGl0eS5hbWF6b25hd3MuY29tJywge1xuICAgICAgICAgICAgICAgIFwiU3RyaW5nRXF1YWxzXCI6IHsgXCJjb2duaXRvLWlkZW50aXR5LmFtYXpvbmF3cy5jb206YXVkXCI6IHRoaXMuaWRlbnRpdHlQb29sLmlkZW50aXR5UG9vbElkIH0sXG4gICAgICAgICAgICAgICAgXCJGb3JBbnlWYWx1ZTpTdHJpbmdMaWtlXCI6IHsgXCJjb2duaXRvLWlkZW50aXR5LmFtYXpvbmF3cy5jb206YW1yXCI6IFwiYXV0aGVudGljYXRlZFwiIH1cbiAgICAgICAgICAgIH0sXCJzdHM6QXNzdW1lUm9sZVdpdGhXZWJJZGVudGl0eVwiKVxuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5wbGF5ZXJzUm9sZS5hZGRUb1BvbGljeShuZXcgSUFNLlBvbGljeVN0YXRlbWVudCgpXG4gICAgICAgICAgICAuYWxsb3coKVxuICAgICAgICAgICAgLmFkZEFjdGlvbihcIm1vYmlsZWFuYWx5dGljczpQdXRFdmVudHNcIilcbiAgICAgICAgICAgIC5hZGRBY3Rpb24oXCJjb2duaXRvLXN5bmM6KlwiKVxuICAgICAgICAgICAgLmFkZEFjdGlvbnMoXCJjb2duaXRvLWlkZW50aXR5OipcIilcbiAgICAgICAgICAgIC5hZGRBbGxSZXNvdXJjZXMoKVxuICAgICAgICApO1xuICAgICAgICB0aGlzLmFkZFJlc291cmNlKCdzZWN1cml0eS5wbGF5ZXJzcm9sZScsdGhpcy5wbGF5ZXJzUm9sZSk7XG5cbiAgICAgICAgbmV3IENvZ25pdG8uQ2ZuVXNlclBvb2xHcm91cCh0aGlzLCB0aGlzLnByb3BlcnRpZXMuZ2V0QXBwUmVmTmFtZSgpICsgJ1BsYXllcnMnLCB7XG4gICAgICAgICAgICBncm91cE5hbWU6ICdQbGF5ZXJzJyxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnUGxheWVycyBvZiB0aGUgZ2FtZS4nLFxuICAgICAgICAgICAgcHJlY2VkZW5jZTogOTk5OSxcbiAgICAgICAgICAgIHJvbGVBcm46IHRoaXMucGxheWVyc1JvbGUucm9sZUFybixcbiAgICAgICAgICAgIHVzZXJQb29sSWQ6IHRoaXMudXNlclBvb2wudXNlclBvb2xJZFxuICAgICAgICB9KTtcblxuICAgICAgICAvLyBNQU5BR0VSU1xuICAgICAgICB0aGlzLm1hbmFnZXJzUm9sZSA9IG5ldyBJQU0uUm9sZSh0aGlzLCB0aGlzLnByb3BlcnRpZXMuZ2V0QXBwUmVmTmFtZSgpICsgJ01hbmFnZXJzUm9sZScsIHtcbiAgICAgICAgICAgIHJvbGVOYW1lIDogdGhpcy5wcm9wZXJ0aWVzLmdldEFwcFJlZk5hbWUoKSArICdNYW5hZ2Vyc1JvbGUnLFxuICAgICAgICAgICAgYXNzdW1lZEJ5OiBuZXcgSUFNLkZlZGVyYXRlZFByaW5jaXBhbCgnY29nbml0by1pZGVudGl0eS5hbWF6b25hd3MuY29tJywge1xuICAgICAgICAgICAgICAgIFwiU3RyaW5nRXF1YWxzXCI6IHsgXCJjb2duaXRvLWlkZW50aXR5LmFtYXpvbmF3cy5jb206YXVkXCI6IHRoaXMuaWRlbnRpdHlQb29sLmlkZW50aXR5UG9vbElkIH0sXG4gICAgICAgICAgICAgICAgXCJGb3JBbnlWYWx1ZTpTdHJpbmdMaWtlXCI6IHsgXCJjb2duaXRvLWlkZW50aXR5LmFtYXpvbmF3cy5jb206YW1yXCI6IFwiYXV0aGVudGljYXRlZFwiIH1cbiAgICAgICAgICAgIH0sXCJzdHM6QXNzdW1lUm9sZVdpdGhXZWJJZGVudGl0eVwiKVxuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5tYW5hZ2Vyc1JvbGUuYXR0YWNoTWFuYWdlZFBvbGljeSgnYXJuOmF3czppYW06OmF3czpwb2xpY3kvQW1hem9uQ29nbml0b1Bvd2VyVXNlcicpO1xuICAgICAgICB0aGlzLm1hbmFnZXJzUm9sZS5hZGRUb1BvbGljeShuZXcgSUFNLlBvbGljeVN0YXRlbWVudCgpXG4gICAgICAgICAgICAuYWxsb3coKVxuICAgICAgICAgICAgLmFkZEFjdGlvbihcIm1vYmlsZWFuYWx5dGljczpQdXRFdmVudHNcIilcbiAgICAgICAgICAgIC5hZGRBY3Rpb24oXCJjb2duaXRvLXN5bmM6KlwiKVxuICAgICAgICAgICAgLmFkZEFjdGlvbnMoXCJjb2duaXRvLWlkZW50aXR5OipcIilcbiAgICAgICAgICAgIC5hZGRBbGxSZXNvdXJjZXMoKVxuICAgICAgICApO1xuICAgICAgICB0aGlzLmFkZFJlc291cmNlKCdzZWN1cml0eS5tYW5hZ2Vyc3JvbGUnLHRoaXMubWFuYWdlcnNSb2xlKTtcbiAgICAgICAgbmV3IENvZ25pdG8uQ2ZuVXNlclBvb2xHcm91cCh0aGlzLCB0aGlzLnByb3BlcnRpZXMuZ2V0QXBwUmVmTmFtZSgpICsgJ01hbmFnZXJzJywge1xuICAgICAgICAgICAgZ3JvdXBOYW1lOiAnTWFuYWdlcnMnLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246ICdNYW5hZ2VycyBvZiB0aGUgZ2FtZS4nLFxuICAgICAgICAgICAgcHJlY2VkZW5jZTogMCxcbiAgICAgICAgICAgIHJvbGVBcm46IHRoaXMubWFuYWdlcnNSb2xlLnJvbGVBcm4sXG4gICAgICAgICAgICB1c2VyUG9vbElkOiB0aGlzLnVzZXJQb29sLnVzZXJQb29sSWRcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBjb25maWd1cmVJZGVudGl0eVBvb2xSb2xlcygpIHtcbiAgICAgICAgdGhpcy51bmF1dGhlbnRpY2F0ZWRSb2xlID0gbmV3IElBTS5Sb2xlKHRoaXMsIHRoaXMucHJvcGVydGllcy5nZXRBcHBSZWZOYW1lKCkgKyAnVW5hdXRoUm9sZScsIHtcbiAgICAgICAgICAgIHJvbGVOYW1lIDogdGhpcy5wcm9wZXJ0aWVzLmdldEFwcFJlZk5hbWUoKSArICdVbmF1dGhSb2xlJyxcbiAgICAgICAgICAgIGFzc3VtZWRCeTogbmV3IElBTS5GZWRlcmF0ZWRQcmluY2lwYWwoJ2NvZ25pdG8taWRlbnRpdHkuYW1hem9uYXdzLmNvbScsIHtcbiAgICAgICAgICAgICAgICBcIlN0cmluZ0VxdWFsc1wiOiB7IFwiY29nbml0by1pZGVudGl0eS5hbWF6b25hd3MuY29tOmF1ZFwiOiB0aGlzLmlkZW50aXR5UG9vbC5pZGVudGl0eVBvb2xJZCB9LFxuICAgICAgICAgICAgICAgIFwiRm9yQW55VmFsdWU6U3RyaW5nTGlrZVwiOiB7IFwiY29nbml0by1pZGVudGl0eS5hbWF6b25hd3MuY29tOmFtclwiOiBcInVuYXV0aGVudGljYXRlZFwiIH1cbiAgICAgICAgICAgIH0pXG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLnVuYXV0aGVudGljYXRlZFJvbGUuYWRkVG9Qb2xpY3kobmV3IElBTS5Qb2xpY3lTdGF0ZW1lbnQoKVxuICAgICAgICAgICAgLmFsbG93KClcbiAgICAgICAgICAgIC5hZGRBY3Rpb24oXCJtb2JpbGVhbmFseXRpY3M6UHV0RXZlbnRzXCIpXG4gICAgICAgICAgICAuYWRkQWN0aW9uKFwiY29nbml0by1zeW5jOipcIilcbiAgICAgICAgICAgIC5hZGRBY3Rpb25zKFwiY29nbml0by1pZGVudGl0eToqXCIpXG4gICAgICAgICAgICAuYWRkQWxsUmVzb3VyY2VzKClcbiAgICAgICAgKTsgXG4gICAgICAgIFxuXG4gICAgICAgIG5ldyBDb2duaXRvLkNmbklkZW50aXR5UG9vbFJvbGVBdHRhY2htZW50KHRoaXMsIHRoaXMucHJvcGVydGllcy5nZXRBcHBSZWZOYW1lKCkgKyBcIklEUFJvbGVzXCIsXG4gICAgICAgIHtcbiAgICAgICAgICAgIGlkZW50aXR5UG9vbElkIDogdGhpcy5pZGVudGl0eVBvb2wuaWRlbnRpdHlQb29sSWRcbiAgICAgICAgICAgLHJvbGVzIDoge1xuICAgICAgICAgICAgICAgYXV0aGVudGljYXRlZCA6IHRoaXMucGxheWVyc1JvbGUucm9sZUFybixcbiAgICAgICAgICAgICAgIHVuYXV0aGVudGljYXRlZCA6IHRoaXMudW5hdXRoZW50aWNhdGVkUm9sZS5yb2xlQXJuXG4gICAgICAgICAgIH1cbiAgICAgICAgICAgLy8gVE8tRE8gSWRlbnRpZnkgd2l0aCB0aGUgdGVhbSBmcm9tIENESyBob3cgdG8gaW1wbGVtZW50IHRoaXNcbiAgICAgICAvKiAgICAscm9sZU1hcHBpbmdzIDoge1xuICAgICAgICAgICAgICAgdHlwZTogXCJSdWxlc1wiLFxuICAgICAgICAgICAgICAgYW1iaWd1b3VzUm9sZVJlc29sdXRpb246IFwiRGVueVwiLFxuICAgICAgICAgICAgICAgcnVsZXNDb25maWd1cmF0aW9uOiB7XG4gICAgICAgICAgICAgICAgICAgcnVsZXM6IFtcbiAgICAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgY2xhaW06IFwiY29nbml0bzpwcmVmZXJyZWRfcm9sZVwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgbWF0Y2hUeXBlOiBcIkNvbnRhaW5zXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZTogXCJNYW5hZ2Vyc1wiLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgcm9sZUFybjogdGhpcy5tYW5hZ2Vyc1JvbGVcbiAgICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgY2xhaW06IFwiY29nbml0bzpwcmVmZXJyZWRfcm9sZVwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgbWF0Y2hUeXBlOiBcIkNvbnRhaW5zXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZTogXCJQbGF5ZXJzXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICByb2xlQXJuOiB0aGlzLnBsYXllcnNSb2xlXG4gICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICB9XG4gICAgICAgICAgIH1cbiAgICAgICAgICAgKi9cbiAgICAgICB9KTtcblxuICAgIH1cblxuICAgIHByaXZhdGUgY3JlYXRQb3N0UmVnaXN0cmF0aW9uTGFtYmRhVHJpZ2dlcigpIHtcblxuICAgICAgICB0aGlzLnBvc3RSZWdpc3RyYXRpb25UcmlnZ2VyRnVuY3Rpb25Sb2xlID0gbmV3IElBTS5Sb2xlKHRoaXMsIHRoaXMucHJvcGVydGllcy5nZXRBcHBSZWZOYW1lKCkgKyAnUG9zdFJlZ2lzdHJhdGlvbkZuX1JvbGUnLCB7XG4gICAgICAgICAgICByb2xlTmFtZTogdGhpcy5wcm9wZXJ0aWVzLmdldEFwcFJlZk5hbWUoKSArICdQb3N0UmVnaXN0cmF0aW9uRm5fUm9sZSdcbiAgICAgICAgICAgICwgYXNzdW1lZEJ5OiBuZXcgSUFNLlNlcnZpY2VQcmluY2lwYWwoJ2xhbWJkYS5hbWF6b25hd3MuY29tJylcbiAgICAgICAgICAgICwgbWFuYWdlZFBvbGljeUFybnM6IFsnYXJuOmF3czppYW06OmF3czpwb2xpY3kvc2VydmljZS1yb2xlL0FXU0xhbWJkYUJhc2ljRXhlY3V0aW9uUm9sZSddXG4gICAgICAgIH0pO1xuICAgICAgICBcbiAgICAgICAgdGhpcy5wb3N0UmVnaXN0cmF0aW9uVHJpZ2dlckZ1bmN0aW9uID1cbiAgICAgICAgICAgIG5ldyBMYW1iZGEuRnVuY3Rpb24odGhpcywgdGhpcy5wcm9wZXJ0aWVzLmdldEFwcFJlZk5hbWUoKSArICdQb3N0UmVnaXN0cmF0aW9uJywge1xuICAgICAgICAgICAgICAgIHJ1bnRpbWU6IExhbWJkYS5SdW50aW1lLk5vZGVKUzgxMCxcbiAgICAgICAgICAgICAgICBoYW5kbGVyOiAnaW5kZXguaGFuZGxlcicsXG4gICAgICAgICAgICAgICAgY29kZTogTGFtYmRhLkNvZGUuYXNzZXQobGFtYmRhc0xvY2F0aW9uICsgJ3Bvc3RyZWdpc3RyYXRpb24nKVxuICAgICAgICAgICAgICAgICwgZnVuY3Rpb25OYW1lOiB0aGlzLnByb3BlcnRpZXMuZ2V0QXBwUmVmTmFtZSgpICsgJ1Bvc3RSZWdpc3RyYXRpb25GbidcbiAgICAgICAgICAgICAgICAsIGRlc2NyaXB0aW9uOiAnVGhpcyBmdW5jdGlvbiBhZGRzIGFuIHVzZXIgdG8gdGhlIFBsYXllcnMgZ3JvdXAgYWZ0ZXIgY29uZmlybWF0aW9uJ1xuICAgICAgICAgICAgICAgICwgbWVtb3J5U2l6ZTogMTI4XG4gICAgICAgICAgICAgICAgLCB0aW1lb3V0OiA2MFxuICAgICAgICAgICAgICAgICwgcm9sZTogdGhpcy5wb3N0UmVnaXN0cmF0aW9uVHJpZ2dlckZ1bmN0aW9uUm9sZSBcbiAgICAgICAgICAgIH0pO1xuICAgIH1cblxufSJdfQ==