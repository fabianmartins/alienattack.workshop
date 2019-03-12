import { Construct } from '@aws-cdk/cdk';
import { ResourceAwareConstruct, IParameterAwareProps } from './../resourceawarestack';
import Cognito = require('@aws-cdk/aws-cognito');
import IAM = require('@aws-cdk/aws-iam');
import Lambda = require('@aws-cdk/aws-lambda');
import Cfn = require('@aws-cdk/aws-cloudformation');
export interface SimpleUserPool {
    userPoolId: string;
    userPoolUrl: string;
    userPoolArn: string;
    userPoolProviderName: string;
    userPoolName: string;
}
export declare class SecurityLayer extends ResourceAwareConstruct {
    userPool: SimpleUserPool;
    simpleUserPool: Cfn.CustomResource;
    identityPool: Cognito.CfnIdentityPool;
    userPoolClient: Cognito.CfnUserPoolClient;
    playersRole: IAM.Role;
    managersRole: IAM.Role;
    unauthenticatedRole: IAM.Role;
    postRegistrationTriggerFunction: Lambda.Function;
    postRegistrationTriggerFunctionRole: IAM.Role;
    getUserPoolId(): string;
    getUserPoolUrl(): string;
    getUserPoolArn(): string;
    getUserPoolClient(): Cognito.CfnUserPoolClient;
    getUserPoolClientId(): string;
    getIdentityPool(): Cognito.CfnIdentityPool;
    getIdentityPoolId(): string;
    constructor(parent: Construct, name: string, props: IParameterAwareProps);
    private createUserPool;
    private createUserPoolClientApp;
    private createIdentityPool;
    private createUserPoolGroups;
    private configureIdentityPoolRoles;
    private creatPostRegistrationLambdaTrigger;
}
