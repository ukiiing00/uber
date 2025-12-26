import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { GqlExecutionContext } from "@nestjs/graphql";
import { AllowedRoles } from "./role.decorator";

@Injectable()
export class AuthGuard implements CanActivate {
    constructor(private readonly reflector: Reflector) {}
    canActivate(context: ExecutionContext) {
        const roles = this.reflector.get<AllowedRoles[]>('roles', context.getHandler());
        if (!roles) {
            return true;
        }
        const graphqlContext = GqlExecutionContext.create(context).getContext(); // transform the context of the graphql request to a graphql context
        const user = graphqlContext['user'];
        if (!user) {
            return false;
        }
        if (roles.includes('Any')) {
            return true;
        }
        return roles.includes(user.role);
    }
}