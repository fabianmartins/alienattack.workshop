import { App } from '@aws-cdk/cdk';
import { IParameterAwareProps, ParameterAwareProps, ResourceAwareStack} from '../resourceawarestack';

import { SecurityLayer } from './securityLayer';
import { ConfigurationLayer } from './configurationLayer';
import { StorageLayer } from './storageLayer';
import { DatabaseLayer } from './databaseLayer';
import { IngestionConsumptionLayer } from './ingestionConsumptionLayer';
import { ProcessingLayer } from './processingLayer';
import { ContentDeliveryLayer } from './contentDeliveryLayer';


export class MainLayer extends ResourceAwareStack  {

  constructor(scope: App, id: string, props?: IParameterAwareProps) {
    super(scope, id, props);
    this.buildResources();
  }

  buildResources() {

    // security layer
    let securityLayer =
      new SecurityLayer(this, 'SecurityLayer', this.properties);
    
    // configuration layer
    let configLayerProps = new ParameterAwareProps(this.properties);
    
    let ssmProperties = new Map<string,string>();
    ssmProperties.set("Region", this.region);
    ssmProperties.set("ClientId", securityLayer.getUserPoolClientId());
    ssmProperties.set("UserpoolId", securityLayer.getUserPoolId());
    ssmProperties.set("UserPoolURL", securityLayer.getUserPoolUrl());
    ssmProperties.set("IdentityPoolId", securityLayer.getIdentityPoolId());
    // MISSING PARAMETER
    // ssmProperties.set("Session", "null");
    configLayerProps.addParameter('ssmParameters',ssmProperties);
    // MISSING PARAMETER  - side effect - uncomment the next line to fix it
   // let configLayer =
      new ConfigurationLayer(this, 'ConfigurationLayer', configLayerProps);

    // storage layer
    let storageLayer =
      new StorageLayer(this, 'StorageStorage', this.properties);


    // UNCOMMENT the following section if you want to have the CDN created. It will take 20 minutes to build/destroy
    /*
    let cdnLayerProps = new ParameterAwareProps(this.properties);
    cdnLayerProps.addParameter('appbucket',storageLayer.getResource('appbucket'));
      new ContentDeliveryLayer(this,'ContentDeliveryLayer',cdnLayerProps);
      */


    // database layer
    let databaseLayer =
      new DatabaseLayer(this, 'DatabaseLayer', this.properties);
    
    // processing layer
    let processingLayerProps = new ParameterAwareProps(this.properties);
    // MISSING PARAMETER - side effect - uncomment the next line
    // processingLayerProps.addParameter('parameter.session', configLayer.getResource('parameter.session'));
      processingLayerProps.addParameter('table.sessionControl', databaseLayer.getResource('table.sessionControl'));
      processingLayerProps.addParameter('table.sessionTopX', databaseLayer.getResource('table.sessionTopX'));
      processingLayerProps.addParameter('table.session', databaseLayer.getResource('table.session'));
    let processingLayer = new ProcessingLayer(this, 'ProcessingLayer', processingLayerProps);

    // Ingestion/consumption layer
    let ingestionConsumptionLayerProps = new ParameterAwareProps(processingLayerProps);
    ingestionConsumptionLayerProps.addParameter('rawbucketarn', storageLayer.getRawDataBucketArn());
    ingestionConsumptionLayerProps.addParameter('userpool',securityLayer.getUserPoolArn());
    ingestionConsumptionLayerProps.addParameter('userpoolid', securityLayer.getUserPoolId());
    ingestionConsumptionLayerProps.addParameter('table.session',databaseLayer.getResource('table.session'));
    ingestionConsumptionLayerProps.addParameter('table.sessiontopx',databaseLayer.getResource('table.sessiontopx'));
    ingestionConsumptionLayerProps.addParameter('lambda.allocate',processingLayer.getAllocateFunctionRef());
    ingestionConsumptionLayerProps.addParameter('lambda.deallocate',processingLayer.getDeallocateFunctionArn());
    ingestionConsumptionLayerProps.addParameter('lambda.scoreboard',processingLayer.getScoreboardFunctionRef());
    ingestionConsumptionLayerProps.addParameter('security.playersrole', securityLayer.getResource('security.playersrole'));
    ingestionConsumptionLayerProps.addParameter('security.managersrole', securityLayer.getResource('security.managersrole'));
    new IngestionConsumptionLayer(this, 'IngestionConsumptionLayer',ingestionConsumptionLayerProps); 
  }
}