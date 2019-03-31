import { Construct } from '@aws-cdk/cdk';
import { ResourceAwareConstruct, IParameterAwareProps } from './../resourceawarestack';
/**
 * Configuration Layer is a construct designed to acquire and store configuration
 * data to be used by the system
 */
export declare class ConfigurationLayer extends ResourceAwareConstruct {
    constructor(parent: Construct, name: string, props: IParameterAwareProps);
    private createParameter;
}
