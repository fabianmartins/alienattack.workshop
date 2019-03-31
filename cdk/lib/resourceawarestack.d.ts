import { App, Stack, Construct, StackProps } from '@aws-cdk/cdk';
export interface IFlexNameApplication {
    applicationName?: string;
    suffix?: string;
    getAppRefName(): string;
}
export interface IResourceAware {
    getResources(): Map<string, any>;
    getResource(resourceName: string): any | undefined;
    addResources(resources: Map<string, any>): void;
    addResource(map: string, resource: any): void;
    getResourcesNames(): IterableIterator<string> | string[];
}
export interface IParameterAware {
    getParameters(): Map<string, any>;
    getParameter(parameterName: string): any | undefined;
    addParameters(parameters: Map<string, any>): void;
    addParameter(map: string, resource: any): void;
}
export interface IDeploymentTarget {
    accountId?: string;
    region?: string;
}
export declare class ResourceBag implements IResourceAware {
    private resources;
    constructor(resources?: IResourceAware);
    getResources(): Map<string, any>;
    addResources(resources: Map<string, any>): void;
    addResource(key: string, resource: any): void;
    getResource(key: string): any | undefined;
    getResourcesNames(): IterableIterator<string> | never[];
}
export interface IParameterAwareProps extends StackProps, IParameterAware, IFlexNameApplication, IDeploymentTarget {
}
export declare class ParameterAwareProps implements IParameterAwareProps {
    accountId?: string;
    region?: string;
    static defaultApplicationName: string;
    applicationName?: string;
    setApplicationName(appName: string): void;
    getAppRefName(): string;
    suffix?: string;
    setSuffix(suffix: string): void;
    parameters: Map<string, any>;
    getParameters(): Map<string, any>;
    addParameters(parameters: Map<string, any>): void;
    addParameter(key: string, parameter: any): void;
    getParameter(key: string): any | undefined;
    constructor(props?: IParameterAwareProps);
}
export declare class ResourceAwareStack extends Stack implements IResourceAware {
    protected resources: Map<string, any>;
    protected scope: App;
    protected properties: IParameterAwareProps;
    constructor(parent: App, name: string, props?: IParameterAwareProps);
    getResources(): Map<string, any>;
    addResources(resources: Map<string, any>): void;
    addResource(key: string, resource: any): void;
    getResource(key: string): any | undefined;
    getResourcesNames(): IterableIterator<string> | never[];
    getProperties(): IParameterAwareProps;
}
export declare class ResourceAwareConstruct extends Construct implements IResourceAware {
    resources: Map<string, any>;
    protected properties: IParameterAwareProps;
    constructor(scope: Construct, id: string, props: IParameterAwareProps);
    getResources(): Map<string, any>;
    addResources(resources: Map<string, any>): void;
    addResource(key: string, resource: any): void;
    getResource(key: string): any | undefined;
    getResourcesNames(): IterableIterator<string> | never[];
    getProperties(): IParameterAwareProps;
}
