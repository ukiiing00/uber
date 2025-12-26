# ExecutionContext와 메타데이터 기반 권한 체크

## 개요

NestJS의 Guard는 **ExecutionContext**와 **Reflector**를 활용하여 메타데이터 기반의 권한 체크를 수행합니다. 이 문서는 메타데이터가 언제 저장되고, 어떻게 읽히며, ExecutionContext가 무엇을 담고 있는지 상세히 설명합니다.

## 핵심 개념

### 1. ExecutionContext란?

**ExecutionContext는 현재 처리 중인 요청의 전반적인 정보를 담은 컨테이너입니다.**

```typescript
canActivate(context: ExecutionContext) {
    // context가 제공하는 정보:
    
    context.getHandler()   // 실행하려는 메서드 (함수 객체)
    context.getClass()     // 메서드가 속한 클래스
    context.getArgs()      // 메서드의 인자들
    context.getType()      // 요청 타입 ('http', 'graphql', 'rpc')
}
```

### 2. 메타데이터 저장 시점

메타데이터는 **애플리케이션 시작 시 (클래스 로딩 시점)** 함수 객체에 저장됩니다.

```typescript
// ===== 애플리케이션 부팅 시 (한 번만) =====
class RestaurantsResolver {
    @Role(['Owner'])  // ← 이 순간! 메타데이터 저장
    createRestaurant() {
        // 함수 정의
    }
}
// createRestaurant 함수 객체에 { roles: ['Owner'] } 영구 저장

// ===== 나중에 요청이 올 때마다 =====
// 이미 저장된 메타데이터를 읽기만 함
const roles = this.reflector.get('roles', handler);  // ['Owner']
```

### 3. 메타데이터 저장 위치

**메타데이터는 함수 객체 자체에 저장됩니다** (함수 내부가 아님!)

```typescript
@Role(['Owner'])  // ← 함수 객체에 스티커처럼 붙음
async createRestaurant() {
    // ❌ 여기 내부에 저장되는 게 아님!
    console.log('실행 중...');
}

// ✅ 실제 저장 위치 (개념적으로):
createRestaurant[Symbol.for('design:roles')] = ['Owner'];
// 또는
Reflect.defineMetadata('roles', ['Owner'], createRestaurant);
```

## 전체 흐름

### 1. 메타데이터 정의 (role.decorator.ts)

```typescript
import { SetMetadata } from '@nestjs/common';
import { UserRole } from 'src/users/entities/user.entity';

export type AllowedRoles = keyof typeof UserRole | 'Any';

// SetMetadata를 사용해서 메타데이터 저장
export const Role = (roles: string[]) => SetMetadata('roles', roles);
//                                        ↑ 'roles'라는 키로 저장
```

### 2. 메타데이터 사용 (restaurants.resolver.ts)

```typescript
@Resolver(() => Restaurant)
export class RestaurantsResolver {
    
    @Mutation(() => CreateRestaurantOutput)
    @Role(['Owner'])  // ← SetMetadata('roles', ['Owner']) 실행
    createRestaurant(
        @AuthUser() authUser: User,
        @Args('input') input: CreateRestaurantInput
    ) {
        return this.restaurantsService.createRestaurant(authUser, input);
    }
    
    @Query(() => [Restaurant])
    @Role(['Any'])  // ← SetMetadata('roles', ['Any']) 실행
    restaurants() {
        return this.restaurantsService.findAll();
    }
    
    @Query(() => [Restaurant])
    // ← @Role이 없으면 메타데이터도 없음 (public 엔드포인트)
    publicRestaurants() {
        return this.restaurantsService.findAll();
    }
}
```

### 3. 메타데이터 읽기 (auth.guard.ts)

```typescript
import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { GqlExecutionContext } from "@nestjs/graphql";
import { AllowedRoles } from "./role.decorator";

@Injectable()
export class AuthGuard implements CanActivate {
    constructor(private readonly reflector: Reflector) {}
    
    canActivate(context: ExecutionContext) {
        // 1️⃣ 현재 실행하려는 메서드의 'roles' 메타데이터 가져오기
        const roles = this.reflector.get<AllowedRoles[]>('roles', context.getHandler());
        //            ↑ Reflector      ↑ 키 이름           ↑ 메서드(함수) 참조
        
        // 2️⃣ roles가 없으면 → 인증 불필요 (public 엔드포인트)
        if (!roles) {
            return true;  // ✅ 접근 허용
        }
        
        // 3️⃣ GraphQL context에서 user 가져오기
        const graphqlContext = GqlExecutionContext.create(context).getContext();
        const user = graphqlContext['user'];
        
        // 4️⃣ 로그인하지 않았으면 → 거부
        if (!user) {
            return false;  // ❌ 접근 거부
        }
        
        // 5️⃣ 'Any'가 포함되어 있으면 → 로그인만 했으면 OK
        if (roles.includes('Any')) {
            return true;  // ✅ 접근 허용
        }
        
        // 6️⃣ 사용자의 role이 허용된 roles에 포함되는지 확인
        return roles.includes(user.role);
    }
}
```

## Reflector.get() 상세 설명

### 문법

```typescript
this.reflector.get<AllowedRoles[]>('roles', context.getHandler())
//              ↑ 제네릭 타입      ↑ 키    ↑ 메타데이터 위치
```

### 각 파라미터 의미

```typescript
this.reflector.get<AllowedRoles[]>('roles', context.getHandler())
```

1. **`<AllowedRoles[]>`** (제네릭 타입)
   - 반환될 데이터의 타입 지정
   - `('Client' | 'Owner' | 'Delivery' | 'Any')[]`

2. **`'roles'`** (첫 번째 인자 - 키)
   - 찾고자 하는 메타데이터의 키 이름
   - `SetMetadata('roles', roles)`에서 설정한 키와 일치해야 함

3. **`context.getHandler()`** (두 번째 인자 - 타겟)
   - 메타데이터를 찾을 대상
   - `getHandler()`: 현재 실행 중인 **메서드(함수 객체)**를 반환

### context.getHandler() vs context.getClass()

```typescript
@Role(['Admin'])  // ← 클래스 레벨 메타데이터
class RestaurantsResolver {
    
    @Role(['Owner'])  // ← 메서드 레벨 메타데이터
    createRestaurant() { ... }
}

// Guard에서:
this.reflector.get('roles', context.getHandler())  // → ['Owner']
this.reflector.get('roles', context.getClass())    // → ['Admin']
```

## ExecutionContext 상세

### ExecutionContext가 담고 있는 정보

```typescript
canActivate(context: ExecutionContext) {
    // 📦 1. 실행할 메서드
    const handler = context.getHandler();
    // → createRestaurant 함수 객체
    
    // 📦 2. 메서드가 속한 클래스
    const controllerClass = context.getClass();
    // → RestaurantsResolver 클래스
    
    // 📦 3. 메서드의 인자들
    const args = context.getArgs();
    // → [root, args, context, info] (GraphQL의 경우)
    
    // 📦 4. 요청 타입
    const type = context.getType();
    // → 'graphql', 'http', 'rpc' 등
    
    // 📦 5. GraphQL Context 변환
    const gqlContext = GqlExecutionContext.create(context);
    const gqlContextObject = gqlContext.getContext();
    // → { user: {...}, req: {...}, res: {...} }
}
```

### ExecutionContext ≠ 함수 실행 컨텍스트

```typescript
// ❌ ExecutionContext는 이게 아님:
createRestaurant() {
    // JavaScript 실행 컨텍스트:
    // - this 바인딩
    // - 지역 변수
    // - 클로저 변수
    const localVar = 123;
}

// ✅ ExecutionContext는 이것:
// NestJS가 제공하는 요청 처리 정보 래퍼
const executionContext = {
    handler: createRestaurant,           // 실행할 함수
    class: RestaurantsResolver,          // 클래스
    args: [root, args, context, info],   // 인자
    type: 'graphql',                     // 타입
    // + 추가 컨텍스트 정보
}
```

## 실제 요청 처리 타임라인

```typescript
// ===== 1. 클라이언트 요청 =====
mutation {
    createRestaurant(input: { name: "Pizza" }) {
        ok
    }
}

// ===== 2. Middleware (JWT 검증) =====
// JWT 토큰에서 사용자 정보 추출
request['user'] = { id: 1, email: 'owner@test.com', role: 'Owner' }

// ===== 3. NestJS가 ExecutionContext 생성 =====
const executionContext = {
    handler: createRestaurant,           // 실행할 함수
    class: RestaurantsResolver,          // 클래스
    args: [root, { input: {...} }, { user: {...} }, info],
    type: 'graphql',
    // ... 기타 정보
}

// ===== 4. Guard 실행 (함수 실행 전) =====
@UseGuards(AuthGuard)
canActivate(context: ExecutionContext) {
    // Step 1: 메서드에서 메타데이터 읽기
    const handler = context.getHandler();  // createRestaurant 함수
    const roles = this.reflector.get('roles', handler);  // ['Owner']
    
    // Step 2: GraphQL context에서 user 가져오기
    const gqlContext = GqlExecutionContext.create(context).getContext();
    const user = gqlContext['user'];  // { id: 1, role: 'Owner' }
    
    // Step 3: 권한 체크
    if (!roles) return true;          // public 엔드포인트
    if (!user) return false;          // 로그인 안 함
    if (roles.includes('Any')) return true;  // 로그인만 하면 됨
    return roles.includes(user.role); // role 매칭 체크
}

// ===== 5. Guard 통과 시 메서드 실행 =====
createRestaurant(authUser: User, input: CreateRestaurantInput) {
    // 비즈니스 로직 실행
    return this.restaurantsService.createRestaurant(authUser, input);
}
```

## 시나리오별 예시

### 시나리오 1: Owner만 접근 가능

```typescript
@Mutation(() => Boolean)
@Role(['Owner'])
async createRestaurant() { ... }

// Guard 실행:
const roles = reflector.get('roles', handler);  // ['Owner']
const user = { role: 'Client' };
return roles.includes(user.role);  // false ❌

const user = { role: 'Owner' };
return roles.includes(user.role);  // true ✅
```

### 시나리오 2: 로그인한 사용자는 누구나

```typescript
@Query(() => User)
@Role(['Any'])
async me() { ... }

// Guard 실행:
const roles = reflector.get('roles', handler);  // ['Any']
if (roles.includes('Any')) return true;  // ✅

// user가 있기만 하면 통과 (role 상관없음)
```

### 시나리오 3: 인증 불필요 (public)

```typescript
@Query(() => [Restaurant])
async restaurants() { ... }  // ← @Role 없음

// Guard 실행:
const roles = reflector.get('roles', handler);  // undefined
if (!roles) return true;  // ✅ 누구나 접근 가능
```

### 시나리오 4: 여러 역할 허용

```typescript
@Mutation(() => Boolean)
@Role(['Owner', 'Delivery'])
async updateOrder() { ... }

// Guard 실행:
const roles = reflector.get('roles', handler);  // ['Owner', 'Delivery']
const user = { role: 'Client' };
return roles.includes(user.role);  // false ❌

const user = { role: 'Owner' };
return roles.includes(user.role);  // true ✅

const user = { role: 'Delivery' };
return roles.includes(user.role);  // true ✅
```

## 메타데이터가 저장되는 방식 (내부 동작)

### 데코레이터 실행 과정

```typescript
// ===== role.decorator.ts =====
export const Role = (roles: string[]) => SetMetadata('roles', roles);

// SetMetadata는 내부적으로 이렇게 동작 (간략화):
function SetMetadata(key: string, value: any) {
    return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
        // Reflect API를 사용해서 함수 객체에 메타데이터 저장
        Reflect.defineMetadata(key, value, descriptor.value);
        //                                   ↑ 함수 객체 자체
    };
}
```

### 클래스 로딩 시점

```typescript
// 애플리케이션 부팅 시:
class RestaurantsResolver {
    @Role(['Owner'])  // ← 데코레이터 실행
    createRestaurant() { }
}

// 내부적으로 이런 일이 발생:
const createRestaurant = RestaurantsResolver.prototype.createRestaurant;
Reflect.defineMetadata('roles', ['Owner'], createRestaurant);
// 함수 객체에 메타데이터가 저장됨

// 이후 Guard에서:
const roles = Reflect.getMetadata('roles', createRestaurant);
// → ['Owner']
```

## 주요 개념 정리

### 1. 메타데이터는 함수 객체에 저장

```typescript
// ✅ 함수 객체에 스티커처럼 붙음
@Role(['Owner'])
createRestaurant() { }

// ❌ 함수 내부나 실행 컨텍스트가 아님
createRestaurant() {
    // 여기가 아님!
}
```

### 2. 메타데이터는 애플리케이션 시작 시 저장

```typescript
// 시작 시 (한 번만)
클래스 로딩 → @Role(['Owner']) 실행 → 메타데이터 저장

// 요청 처리 시 (매 요청마다)
Guard 실행 → 메타데이터 읽기 (이미 저장됨)
```

### 3. Guard는 함수 실행 전에 동작

```typescript
클라이언트 요청
    ↓
Middleware (JWT)
    ↓
Guard (권한 체크) ← 여기서 메타데이터 사용
    ↓ (통과 시)
메서드 실행 ← 여기서는 메타데이터 안 씀
```

### 4. ExecutionContext는 요청 정보 컨테이너

```typescript
// 매 요청마다 생성되는 정보 묶음:
ExecutionContext = {
    handler: 실행할 함수,
    class: 함수가 속한 클래스,
    args: 함수 인자들,
    type: 요청 타입,
    // + GraphQL context, HTTP request 등
}
```

## 실전 팁

### 1. 메타데이터 키 이름 일치시키기

```typescript
// Decorator에서
SetMetadata('roles', roles)  // ← 'roles' 키

// Guard에서
this.reflector.get('roles', handler)  // ← 'roles' 키 (동일해야 함)
```

### 2. 메타데이터 없을 때 처리

```typescript
canActivate(context: ExecutionContext) {
    const roles = this.reflector.get('roles', context.getHandler());
    
    // undefined 체크로 public 엔드포인트 허용
    if (!roles) {
        return true;  // @Role이 없으면 누구나 접근 가능
    }
    
    // ... 권한 체크
}
```

### 3. GraphQL context 변환

```typescript
// HTTP context와 GraphQL context는 구조가 다름
// GqlExecutionContext로 변환 필요
const gqlContext = GqlExecutionContext.create(context);
const user = gqlContext.getContext()['user'];
```

## 결론

- **메타데이터**: 함수 객체에 저장되는 영구적인 정보
- **ExecutionContext**: 현재 요청의 모든 정보를 담은 컨테이너
- **Reflector**: 메타데이터를 읽어오는 도구
- **Guard**: 메서드 실행 전에 메타데이터를 활용해 권한 체크

이 모든 것이 조합되어 **선언적이고 재사용 가능한 권한 체크 시스템**을 만들어냅니다.

