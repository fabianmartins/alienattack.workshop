import { Construct } from '@aws-cdk/cdk';
import { ResourceAwareConstruct, IParameterAwareProps } from './../resourceawarestack';
/**
 * StorageLayer is a construct that describes the required resources
 * to store the static data. That includes both S3 and SystemsManager.
 */
export declare class StorageLayer extends ResourceAwareConstruct {
    constructor(parent: Construct, name: string, props: IParameterAwareProps);
    private createCfnBucket;
    createBuckets(): void;
    getRawDataBucketArn(): string;
}
