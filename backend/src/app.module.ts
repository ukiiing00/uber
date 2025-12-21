import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { RestaurantsModule } from './restaurants/restaurants.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import { Restaurant } from './restaurants/entities/restaurant.entity';
import { UsersModule } from './users/users.module';
import { CommonModule } from './common/common.module';
import { User } from './users/entities/user.entity';
import { JwtModule } from './jwt/jwt.module';
import { JwtMiddleware } from './jwt/jwt.middleware';
import { AuthModule } from './auth/auth.module';


@Module({
  imports: [
  GraphQLModule.forRoot<ApolloDriverConfig>(
    {
      driver: ApolloDriver,
      autoSchemaFile: true,
      graphiql: true,
      context: ({ req }) => ({ user: req['user'] }),
    }
  ),
  ConfigModule.forRoot({
    isGlobal: true,
    envFilePath: process.env.NODE_ENV === 'development' ? '.env.dev' : '.env.test',
    ignoreEnvFile: process.env.NODE_ENV === 'production',
    validationSchema: Joi.object({
      NODE_ENV: Joi.string().valid('development', 'production').required(),
      DATABASE_HOST: Joi.string().required(),
      DATABASE_PORT: Joi.number().required(),
      DATABASE_USER: Joi.string().required(),
      DATABASE_PASSWORD: Joi.string().required(),
      DATABASE_NAME: Joi.string().required(),
      PRIVATE_KEY: Joi.string().required(),
    }),
  }),
  TypeOrmModule.forRoot({
    type: 'postgres',
    host: process.env.DATABASE_HOST,
    port: parseInt(process.env.DATABASE_PORT!),
    username: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
    synchronize: process.env.NODE_ENV !== 'production', // tables will be created automatically
    logging: true, // logs will be shown in the console
    entities: [Restaurant, User],
  }),
   RestaurantsModule,
   UsersModule,
   JwtModule.forRoot({
    privateKey: process.env.PRIVATE_KEY!,
   }),
   AuthModule],
  controllers: [],
  providers: [],
})
export class AppModule implements NestModule{
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(JwtMiddleware).forRoutes({
      path: '/graphql',
      method: RequestMethod.POST,
    });
  }
}
