import { Construct } from '@aws-cdk/cdk';
import { ResourceAwareConstruct, IParameterAwareProps } from './../resourceawarestack';
import KDS = require('@aws-cdk/aws-kinesis');
import KDF = require('@aws-cdk/aws-kinesisfirehose');
/**
 * MISSING KINESIS INTEGRATION - side effect
 * Uncomment the following line to solve it
 */
export declare class IngestionConsumptionLayer extends ResourceAwareConstruct {
    kinesisStreams: KDS.Stream;
    kinesisFirehose: KDF.CfnDeliveryStream;
    /**
     * MISSING KINESIS FIREHOSE - side effect
     * Uncomment the following section to solve it
     */
    private userpool;
    private api;
    constructor(parent: Construct, name: string, props: IParameterAwareProps);
    createKinesis(props: IParameterAwareProps): void;
    createAPIGateway(props: IParameterAwareProps): void;
    updateUsersRoles(props: IParameterAwareProps): void;
}
