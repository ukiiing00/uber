import { Inject, Injectable } from '@nestjs/common';
import { CONFIG_OPTIONS } from './jwt.contants';
import type { JwtModuleOptions } from './jwt.interfaces';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class JwtService {
    @Inject(CONFIG_OPTIONS) private readonly options: JwtModuleOptions;
    sign(payload: any) : string {
        return jwt.sign(payload, this.options.privateKey);
    }
}
