import { Resolver, Query, Mutation, Args } from "@nestjs/graphql";
import { UsersService } from "./users.service";
import { User } from "./entities/user.entity";
import { CreateAccountInput, CreateAccountOutput } from "./dto/create-account.dto";
import { LoginInput, LoginOutput } from "./dto/login.dto";


@Resolver(of => User)
export class UsersResolver {
    constructor(private readonly usersService: UsersService) {}

    @Query(() => Boolean)
    hi() {
        return true;
    }
    @Mutation(() => CreateAccountOutput)
    async createUser(@Args('input') CreateAccountInput: CreateAccountInput): Promise<CreateAccountOutput> {
        try {
            const {ok, error} = await this.usersService.createAccount(CreateAccountInput);
            if (!ok) {
                return { ok, error };
            }
            return { ok: true };
        } catch (error) {
            return { ok: false, error: 'Could not create account.' };
        }
    }

    @Mutation(() => LoginOutput)
    async login(@Args('input') loginInput: LoginInput): Promise<LoginOutput> {
        try {
            const {ok, error, token} = await this.usersService.login(loginInput);
            if (!ok) {
                return { ok, error };
            }
            return { ok: true, token };
        } catch (error) {
            return { ok: false, error: error.message };
        }
    }
}