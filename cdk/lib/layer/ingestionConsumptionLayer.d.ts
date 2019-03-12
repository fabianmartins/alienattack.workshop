import { Construct } from '@aws-cdk/cdk';
import { ResourceAwareConstruct, IParameterAwareProps } from './../resourceawarestack';
import KDS = require('@aws-cdk/aws-kinesis');
import KDF = require('@aws-cdk/aws-kinesisfirehose');
export declare class IngestionConsumptionLayer extends ResourceAwareConstruct {
    kinesisStreams: KDS.Stream;
    kinesisFirehose: KDF.CfnDeliveryStream;
    private rawbucketarn;
    private userpool;
    private api;
    constructor(parent: Construct, name: string, props: IParameterAwareProps);
    createKinesis(props: IParameterAwareProps): void;
    createAPIGateway(props: IParameterAwareProps): void;
    updateUsersRoles(props: IParameterAwareProps): void;
}
