import { Construct } from '@aws-cdk/core';
import { ResourceAwareConstruct, IParameterAwareProps } from './../resourceawarestack'

import DynamoDB = require('@aws-cdk/aws-dynamodb');


export class DatabaseLayer extends ResourceAwareConstruct {
    tables : Map<string,DynamoDB.Table> = new Map();

    constructor(parent: Construct, name: string, props: IParameterAwareProps) {
        super(parent,name, props);
        
        let sessionTable = new DynamoDB.Table(this,props.getApplicationName()+'Session', {
            tableName : props.getApplicationName()+'Session',
            partitionKey : {
                name : 'SessionId',
                type : DynamoDB.AttributeType.STRING
            },
            billingMode : DynamoDB.BillingMode.PAY_PER_REQUEST      
        });
        this.addResource('table.session',sessionTable);

        let sessionControlTable = new DynamoDB.Table(this,props.getApplicationName()+'SessionControl', {
            tableName : props.getApplicationName()+'SessionControl',
            partitionKey : {
                name : 'SessionId',
                type : DynamoDB.AttributeType.STRING
            },
            billingMode : DynamoDB.BillingMode.PAY_PER_REQUEST
        });
        this.addResource('table.sessioncontrol',sessionControlTable);

        let sessionTopXTable = new DynamoDB.Table(this,props.getApplicationName()+'SessionTopX', {
            tableName : props.getApplicationName()+'SessionTopX',
            partitionKey : {
                name : 'SessionId',
                type : DynamoDB.AttributeType.STRING
            },
            billingMode : DynamoDB.BillingMode.PAY_PER_REQUEST
        });
        this.addResource('table.sessiontopx',sessionTopXTable);
    }
}