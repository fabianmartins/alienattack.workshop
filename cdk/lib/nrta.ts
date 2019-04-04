import { ParameterAwareProps, IParameterAwareProps } from '../lib/resourceawarestack';


export class NRTAProps extends ParameterAwareProps {

    constructor(props?: IParameterAwareProps) {
        super(props);
    }

    getBucketNames() : string[] {
        let result : string[] = [];
        result.push((this.getApplicationName()+'.raw').toLowerCase());
        result.push((this.getApplicationName()+'.app').toLowerCase());
        return result; 
      }

}