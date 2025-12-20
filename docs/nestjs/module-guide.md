# NestJS Module 운용 가이드

NestJS Module의 구조와 운용 방법을 실전 예제와 함께 설명합니다.

## 📚 목차
- [Module이란?](#module이란)
- [Module 구성 요소](#module-구성-요소)
- [Provider의 종류](#provider의-종류)
- [Global Module](#global-module)
- [Dynamic Module](#dynamic-module)
- [실전 예제](#실전-예제)

---

## Module이란?

**Module = 애플리케이션의 조립 단위**

NestJS의 Module은 관련된 기능들을 하나로 묶는 컨테이너입니다.

```typescript
@Module({
  imports: [],      // 다른 모듈 가져오기
  providers: [],    // Service, Resolver 등록
  controllers: [],  // Controller 등록
  exports: [],      // 다른 모듈에 공개
})
export class UsersModule {}
```

---

## Module 구성 요소

### 1. imports - 다른 모듈 가져오기

**역할**: 이 모듈에서 사용할 **다른 모듈**을 가져옵니다.

```typescript
@Module({
  imports: [
    TypeOrmModule.forFeature([User]),  // User Repository 사용
    JwtModule.forRoot({ privateKey: '...' }),  // JwtService 사용
    ConfigModule.forRoot({ isGlobal: true }),  // ConfigService 사용
  ]
})
export class UsersModule {}
```

**규칙**:
- `@Module()` 데코레이터가 붙은 **Module만** 가능
- Service, Controller는 불가 ❌

---

### 2. providers - Service/Provider 등록

**역할**: 이 모듈 **내부에서** 사용할 Provider를 등록합니다.

```typescript
@Module({
  providers: [
    UsersService,      // Service
    UsersResolver,     // Resolver (GraphQL)
    AuthGuard,         // Guard
    LoggingInterceptor // Interceptor
  ]
})
export class UsersModule {}
```

**규칙**:
- `@Injectable()` 데코레이터가 붙은 클래스
- 기본적으로 **이 모듈 내부에서만** 사용 가능
- 다른 모듈에서 사용하려면 `exports` 필요

---

### 3. controllers - Controller 등록

**역할**: REST API 엔드포인트를 처리하는 Controller를 등록합니다.

```typescript
@Module({
  controllers: [UsersController]
})
export class UsersModule {}
```

**참고**: GraphQL은 Controller 대신 Resolver 사용

---

### 4. exports - 다른 모듈에 공개

**역할**: 다른 모듈에서 사용할 수 있도록 Provider를 **공개**합니다.

```typescript
// jwt.module.ts
@Module({
  providers: [JwtService],  // ← 생성
  exports: [JwtService],    // ← 공개
})
export class JwtModule {}

// users.module.ts
@Module({
  imports: [JwtModule],  // ← JwtModule import
  providers: [UsersService]
})
export class UsersModule {}

// users.service.ts
@Injectable()
export class UsersService {
  constructor(
    private readonly jwtService: JwtService  // ← 사용 가능!
  ) {}
}
```

**exports가 없으면?**
```typescript
// jwt.module.ts
@Module({
  providers: [JwtService],
  // exports 없음! ❌
})

// users.service.ts
constructor(
  private readonly jwtService: JwtService  // ❌ 에러! 사용 불가
) {}
```

---

## Provider의 종류

Provider는 4가지 방식으로 등록할 수 있습니다.

### 1. Class Provider (기본, 90% 사용)

**가장 많이 사용하는 방식**

```typescript
@Module({
  providers: [UsersService]  // ← 짧은 형태
})

// 실제로는 이것과 동일:
@Module({
  providers: [
    {
      provide: UsersService,   // ← 토큰 (주입 식별자)
      useClass: UsersService   // ← 실제 클래스
    }
  ]
})
```

**사용**:
```typescript
constructor(
  private readonly usersService: UsersService  // ← 자동 주입
) {}
```

---

### 2. Value Provider - 값 직접 주입

**설정값이나 상수를 주입할 때 사용**

```typescript
@Module({
  providers: [
    {
      provide: 'JWT_OPTIONS',  // ← 토큰 (문자열)
      useValue: {
        privateKey: 'secret123',
        expiresIn: '1h'
      }
    },
    JwtService
  ]
})
```

**사용**:
```typescript
@Injectable()
export class JwtService {
  constructor(
    @Inject('JWT_OPTIONS') private readonly options: any
    //     ↑ @Inject 필요!    ↑ useValue의 값
  ) {}
  
  sign(payload: any) {
    return jwt.sign(payload, this.options.privateKey);
  }
}
```

**용도**:
- ✅ 환경 변수 (API_KEY, DB_PASSWORD)
- ✅ 설정 객체 (options)
- ✅ 상수값 (MAX_SIZE, TIMEOUT)
- ✅ 테스트용 Mock 객체

---

### 3. Factory Provider - 동적 생성

**다른 Provider의 값에 따라 동적으로 생성할 때**

```typescript
@Module({
  providers: [
    {
      provide: JwtService,
      useFactory: (config: ConfigService) => {
        const privateKey = config.get('PRIVATE_KEY');
        return new JwtService(privateKey);  // ← 동적 생성
      },
      inject: [ConfigService]  // ← Factory에 주입할 의존성
    }
  ]
})
```

**용도**:
- 다른 Provider 값에 따른 조건부 생성
- 비동기 초기화
- 복잡한 초기화 로직

---

### 4. Alias Provider - 별칭

**기존 Provider에 별칭을 붙일 때**

```typescript
@Module({
  providers: [
    JwtService,
    {
      provide: 'JWT',  // ← 별칭
      useExisting: JwtService  // ← 기존 Provider 참조
    }
  ]
})
```

**사용**:
```typescript
constructor(
  @Inject('JWT') private jwt: JwtService  // ← 같은 인스턴스
) {}
```

---

## Provider 비교표

| 타입 | provide | use... | 사용처 |
|------|---------|--------|--------|
| **Class** | 클래스 | `useClass` | Service, Repository (90%) |
| **Value** | 문자열/토큰 | `useValue` | 설정값, 상수 (5%) |
| **Factory** | 클래스/토큰 | `useFactory` | 동적 생성 (4%) |
| **Alias** | 문자열/토큰 | `useExisting` | 별칭 (1%) |

---

## Global Module

`@Global()` 데코레이터를 사용하면 한 번만 import해도 **모든 모듈에서 사용** 가능합니다.

### 일반 Module vs Global Module

#### ❌ 일반 Module (매번 import 필요)

```typescript
// jwt.module.ts
@Module({
  providers: [JwtService],
  exports: [JwtService]
})
export class JwtModule {}

// users.module.ts
@Module({
  imports: [JwtModule]  // ← import 필요
})

// restaurants.module.ts
@Module({
  imports: [JwtModule]  // ← 또 import 필요
})
```

#### ✅ Global Module (한 번만 import)

```typescript
// jwt.module.ts
@Global()  // ← 전역 선언
@Module({
  providers: [JwtService],
  exports: [JwtService]
})
export class JwtModule {}

// app.module.ts
@Module({
  imports: [JwtModule]  // ← 한 번만!
})

// users.module.ts
@Module({
  imports: []  // ← import 불필요
})

// restaurants.module.ts
@Module({
  imports: []  // ← import 불필요
})
```

### 주의사항

**Global Module도 최소 한 번은 import 필요!**

```
AppModule (imports: [JwtModule])  ← 여기서 한 번
    ↓
전역 등록
    ↓
모든 모듈에서 자동 사용 가능
```

### Global Module 사용 예시

```typescript
// ConfigModule - 전역 설정
ConfigModule.forRoot({ isGlobal: true })

// JwtModule - 전역 인증
@Global()
@Module({...})
export class JwtModule {}
```

---

## Dynamic Module

**런타임에 옵션을 받아 Module을 생성**하는 패턴입니다.

### forRoot 패턴

```typescript
@Module({})
@Global()
export class JwtModule {
  static forRoot(options: JwtModuleOptions): DynamicModule {
    return {
      module: JwtModule,
      providers: [
        // Value Provider로 옵션 저장
        {
          provide: 'JWT_OPTIONS',
          useValue: options
        },
        JwtService
      ],
      exports: [JwtService]
    }
  }
}
```

### 사용

```typescript
// app.module.ts
@Module({
  imports: [
    JwtModule.forRoot({
      privateKey: process.env.PRIVATE_KEY!
    })
  ]
})
export class AppModule {}
```

### DynamicModule 반환값

```typescript
interface DynamicModule {
  module: Type<any>;        // Module 클래스
  imports?: Array<...>;     // 추가 imports
  providers?: Provider[];   // Providers
  controllers?: Type<any>[]; // Controllers
  exports?: Array<...>;     // Exports
  global?: boolean;         // 전역 여부
}
```

---

## 실전 예제

### 예제 1: JwtModule 구현

#### 1단계: Interface 정의

```typescript
// jwt/interfaces/jwt-module-options.interface.ts
export interface JwtModuleOptions {
  privateKey: string;
}
```

#### 2단계: Service 구현

```typescript
// jwt/jwt.service.ts
import { Injectable, Inject } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { JwtModuleOptions } from './interfaces/jwt-module-options.interface';

@Injectable()
export class JwtService {
  constructor(
    @Inject('JWT_OPTIONS') 
    private readonly options: JwtModuleOptions
  ) {}
  
  sign(payload: any): string {
    return jwt.sign(payload, this.options.privateKey, {
      expiresIn: '1h'
    });
  }
  
  verify(token: string): any {
    return jwt.verify(token, this.options.privateKey);
  }
}
```

#### 3단계: Dynamic Module 구현

```typescript
// jwt/jwt.module.ts
import { DynamicModule, Global, Module } from '@nestjs/common';
import { JwtService } from './jwt.service';
import { JwtModuleOptions } from './interfaces/jwt-module-options.interface';

@Module({})
@Global()
export class JwtModule {
  static forRoot(options: JwtModuleOptions): DynamicModule {
    return {
      module: JwtModule,
      providers: [
        // Value Provider - 옵션 저장
        {
          provide: 'JWT_OPTIONS',
          useValue: options
        },
        // Class Provider - Service
        JwtService
      ],
      exports: [JwtService]
    }
  }
}
```

#### 4단계: AppModule에서 등록

```typescript
// app.module.ts
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    JwtModule.forRoot({
      privateKey: process.env.PRIVATE_KEY!
    }),
    UsersModule
  ]
})
export class AppModule {}
```

#### 5단계: 다른 Service에서 사용

```typescript
// users/users.service.ts
@Injectable()
export class UsersService {
  constructor(
    private readonly jwtService: JwtService  // ← 자동 주입
  ) {}
  
  async login(user: User) {
    const token = this.jwtService.sign({ id: user.id });
    return { ok: true, token };
  }
}
```

---

### 예제 2: UsersModule 구현

```typescript
// users/users.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersResolver } from './users.resolver';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User])  // User Repository 사용
    // JwtModule은 @Global이므로 import 불필요
  ],
  providers: [
    UsersResolver,
    UsersService
  ]
  // exports 없음 = 이 모듈 내부에서만 사용
})
export class UsersModule {}
```

---

## Module 설계 베스트 프랙티스

### 1. 단일 책임 원칙

각 Module은 **하나의 기능**만 담당해야 합니다.

```typescript
// ✅ 좋은 예
UsersModule      // 사용자 관리
AuthModule       // 인증
PaymentsModule   // 결제

// ❌ 나쁜 예
AppModule에 모든 기능
```

---

### 2. 명확한 의존성

```typescript
@Module({
  imports: [
    TypeOrmModule.forFeature([User]),  // DB
    JwtModule,                          // 인증
    EmailModule                         // 이메일
  ],
  providers: [UsersService]
})
```

의존성을 명확히 표현하면 코드 이해가 쉬워집니다.

---

### 3. 적절한 exports

**필요한 것만 공개**합니다.

```typescript
@Module({
  providers: [
    UsersService,        // ← 공개
    UsersRepository,     // ← 내부용
    UsersHelper          // ← 내부용
  ],
  exports: [UsersService]  // ← Service만 공개
})
```

---

### 4. Global Module 남용 금지

**자주 사용하는 것만** Global로 만듭니다.

```typescript
// ✅ Global 적합
ConfigModule  // 설정
JwtModule     // 인증
LoggerModule  // 로깅

// ❌ Global 부적합
UsersModule         // 특정 기능
PaymentsModule      // 특정 기능
```

---

## Module 흐름도

```
┌─────────────────────────────────────────┐
│           AppModule (Root)              │
│  - ConfigModule (Global)                │
│  - TypeOrmModule                        │
│  - JwtModule (Global)                   │
└────────────┬────────────────────────────┘
             │
     ┌───────┴───────┐
     │               │
┌────▼────┐     ┌───▼────────┐
│ Users   │     │ Restaurants│
│ Module  │     │ Module     │
└────┬────┘     └───┬────────┘
     │              │
┌────▼─────┐   ┌───▼─────┐
│ Users    │   │ Rest.   │
│ Service  │   │ Service │
└──────────┘   └─────────┘
```

---

## 요약

### Module 구성 요소

| 속성 | 역할 | 예시 |
|------|------|------|
| **imports** | 다른 모듈 가져오기 | `JwtModule`, `TypeOrmModule` |
| **providers** | Service 등록 | `UsersService`, `JwtService` |
| **controllers** | Controller 등록 | `UsersController` |
| **exports** | 다른 모듈에 공개 | `JwtService` |

### Provider 종류

1. **Class Provider**: 일반 Service (90%)
2. **Value Provider**: 설정값, 상수 (5%)
3. **Factory Provider**: 동적 생성 (4%)
4. **Alias Provider**: 별칭 (1%)

### 핵심 개념

- **Module = 기능의 캡슐화**
- **Provider = 의존성 주입 대상**
- **exports = 공개 API**
- **@Global() = 전역 사용**
- **Dynamic Module = 런타임 설정**

---

## 참고 자료

- [NestJS 공식 문서 - Modules](https://docs.nestjs.com/modules)
- [NestJS 공식 문서 - Custom Providers](https://docs.nestjs.com/fundamentals/custom-providers)
- [NestJS 공식 문서 - Dynamic Modules](https://docs.nestjs.com/fundamentals/dynamic-modules)

