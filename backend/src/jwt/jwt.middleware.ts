import { Injectable, NestMiddleware } from "@nestjs/common";
import { NextFunction } from "express";
import { JwtService } from "./jwt.service";
import { UsersService } from "src/users/users.service";


@Injectable()
export class JwtMiddleware implements NestMiddleware {
    constructor(private readonly jwtService: JwtService, private readonly usersService: UsersService,) {}
    async use(req:Request, res: Response, next: NextFunction) {
        if ('x-jwt' in req.headers) {
            const token = req.headers['x-jwt'];
            try {
                const decoded = this.jwtService.verify(token as string);
                if (typeof decoded === 'object' && 'id' in decoded) {
                    const user = await this.usersService.findById(decoded['id']);
                    if (user) {
                        req['user'] = user;
                        // console.log(user);
                    }
                }
            } catch (error) {
                console.log(error);
            }
        }
        next();
    }
}

// export function jwtMiddleware(req: Request, res: Response, next: NextFunction) {
//   console.log(req.headers);
//   next();
// }