import { App } from '@aws-cdk/cdk';
import { IParameterAwareProps, ResourceAwareStack } from '../resourceawarestack';
export declare class MainLayer extends ResourceAwareStack {
    constructor(scope: App, id: string, props?: IParameterAwareProps);
    buildResources(): void;
}
