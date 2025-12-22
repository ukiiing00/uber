import { Inject, Injectable } from '@nestjs/common';
import { CONFIG_OPTIONS } from '../common/common.contants';
import type { JwtModuleOptions } from './jwt.interfaces';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class JwtService {
    @Inject(CONFIG_OPTIONS) private readonly options: JwtModuleOptions;
    sign(payload: any) : string {
        return jwt.sign(payload, this.options.privateKey);
    }
    verify(token: string) : any {
        return jwt.verify(token, this.options.privateKey);
    }
}
