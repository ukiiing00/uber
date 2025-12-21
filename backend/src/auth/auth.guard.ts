import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { GqlExecutionContext } from "@nestjs/graphql";

@Injectable()
export class AuthGuard implements CanActivate {
    canActivate(context: ExecutionContext) {
        const graphqlContext = GqlExecutionContext.create(context).getContext(); // transform the context of the graphql request to a graphql context
        const user = graphqlContext['user'];
        if (!user) {
            return false;
        }
        return true;
    }
}