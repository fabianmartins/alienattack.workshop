import { Construct } from '@aws-cdk/cdk';
import { ResourceAwareConstruct, IParameterAwareProps } from './../resourceawarestack'

import DynamoDB = require('@aws-cdk/aws-dynamodb');


export class DatabaseLayer extends ResourceAwareConstruct {
    tables : Map<string,DynamoDB.Table> = new Map();

    constructor(parent: Construct, name: string, props: IParameterAwareProps) {
        super(parent,name, props);
        
        let sessionTable = new DynamoDB.Table(this,props.getAppRefName()+'Session', {
            tableName : props.getAppRefName()+'Session',
            partitionKey : {
                name : 'SessionId',
                type : DynamoDB.AttributeType.String
            },
            billingMode : DynamoDB.BillingMode.PayPerRequest      
        });
        this.addResource('table.session',sessionTable);

        let sessionControlTable = new DynamoDB.Table(this,props.getAppRefName()+'SessionControl', {
            tableName : props.getAppRefName()+'SessionControl',
            partitionKey : {
                name : 'SessionId',
                type : DynamoDB.AttributeType.String
            },
            billingMode : DynamoDB.BillingMode.PayPerRequest
        });
        this.addResource('table.sessioncontrol',sessionControlTable);

        let sessionTopXTable = new DynamoDB.Table(this,props.getAppRefName()+'SessionTopX', {
            tableName : props.getAppRefName()+'SessionTopX',
            partitionKey : {
                name : 'SessionId',
                type : DynamoDB.AttributeType.String
            },
            billingMode : DynamoDB.BillingMode.PayPerRequest
        });
        this.addResource('table.sessiontopx',sessionTopXTable);
    }
}