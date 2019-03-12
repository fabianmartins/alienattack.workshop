import { Construct } from '@aws-cdk/cdk';
import { ResourceAwareConstruct, IParameterAwareProps } from './../resourceawarestack';
import DynamoDB = require('@aws-cdk/aws-dynamodb');
export declare class DatabaseLayer extends ResourceAwareConstruct {
    tables: Map<string, DynamoDB.Table>;
    constructor(parent: Construct, name: string, props: IParameterAwareProps);
}
