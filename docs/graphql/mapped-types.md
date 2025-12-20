# GraphQL Mapped Types 가이드

NestJS GraphQL에서 제공하는 Mapped Types를 활용하여 효율적으로 DTO를 생성하는 방법을 설명합니다.

## 📚 Mapped Types란?

기존 타입을 **변환**하여 새로운 타입을 생성하는 유틸리티입니다. CRUD 작업에서 반복 코드를 줄여줍니다.

공식 문서: https://docs.nestjs.com/graphql/mapped-types

---

## 🔧 주요 Mapped Types

### 1. PartialType - 모든 필드 Optional

모든 필드를 선택적(optional)으로 만듭니다.

```typescript
import { PartialType } from '@nestjs/graphql';

@InputType()
class CreateUserDto {
  name: string;
  email: string;
  age: number;
}

@InputType()
class UpdateUserDto extends PartialType(CreateUserDto) {
  // 자동 생성:
  // name?: string;
  // email?: string;
  // age?: number;
}
```

**사용 예시**: Update 작업에서 일부 필드만 수정할 때

---

### 2. PickType - 특정 필드만 선택

원하는 필드만 선택하여 새로운 타입 생성

```typescript
import { PickType } from '@nestjs/graphql';

@InputType()
class User {
  name: string;
  email: string;
  password: string;
  age: number;
}

@InputType()
class LoginDto extends PickType(User, ['email', 'password']) {
  // 결과:
  // email: string;
  // password: string;
}
```

**사용 예시**: 로그인, 특정 정보만 필요한 경우

---

### 3. OmitType - 특정 필드 제외

지정한 필드를 제외하고 새로운 타입 생성

```typescript
import { OmitType } from '@nestjs/graphql';

@InputType()
class User {
  id: number;
  name: string;
  email: string;
  createdAt: Date;
}

@InputType()
class CreateUserDto extends OmitType(User, ['id', 'createdAt']) {
  // 결과:
  // name: string;
  // email: string;
}
```

**사용 예시**: Create 작업에서 자동 생성 필드(id, createdAt) 제외

---

### 4. IntersectionType - 두 타입 결합

여러 타입을 하나로 합칩니다.

```typescript
import { IntersectionType } from '@nestjs/graphql';

@InputType()
class CreateUserDto {
  name: string;
  email: string;
}

@InputType()
class AdditionalUserInfo {
  phone: string;
  address: string;
}

@InputType()
class CreateUserWithInfoDto extends IntersectionType(
  CreateUserDto,
  AdditionalUserInfo,
) {
  // 결과:
  // name: string;
  // email: string;
  // phone: string;
  // address: string;
}
```

**사용 예시**: 여러 DTO를 결합할 때

---

## 🎯 실전 예제 - Restaurant CRUD

### 1. Entity 정의

```typescript
// src/restaurants/entities/restaurant.entity.ts
@ObjectType()
@Entity()
export class Restaurant {
  @PrimaryGeneratedColumn()
  @Field(() => Number)
  id: number;
  
  @Column()
  @Field(() => String)
  name: string;

  @Column({ default: true })
  @Field(() => Boolean, { defaultValue: true })
  isVegan: boolean;

  @Column()
  @Field(() => String)
  address: string;

  @Column()
  @Field(() => String)
  ownerName: string;

  @Column()
  @Field(() => String)
  categoryName: string;
}
```

---

### 2. Create DTO (OmitType 사용)

```typescript
// src/restaurants/dto/create-restaurant.dto.ts
import { InputType, OmitType } from '@nestjs/graphql';
import { Restaurant } from '../entities/restaurant.entity';

@InputType()
export class CreateRestaurantDto extends OmitType(Restaurant, ['id']) {
  // id를 제외한 모든 필드가 필수
  // name: string
  // isVegan: boolean
  // address: string
  // ownerName: string
  // categoryName: string
}
```

**GraphQL Mutation**:
```graphql
mutation {
  createRestaurant(
    name: "Pizza House"
    isVegan: false
    address: "123 Main St"
    ownerName: "John"
    categoryName: "Italian"
  ) {
    id
    name
  }
}
```

---

### 3. Update DTO (PartialType 사용)

```typescript
// src/restaurants/dto/update-restaurant.dto.ts
import { ArgsType, Field, InputType, PartialType } from '@nestjs/graphql';
import { CreateRestaurantDto } from './create-restaurant.dto';

@InputType()
export class UpdateRestaurantInputType extends PartialType(CreateRestaurantDto) {
  // 모든 필드가 선택적
  // name?: string
  // isVegan?: boolean
  // address?: string
  // ownerName?: string
  // categoryName?: string
}

@ArgsType()
export class UpdateRestaurantDto {
  @Field(() => Number)
  id: number;  // 업데이트할 레스토랑 ID (필수)
  
  @Field(() => UpdateRestaurantInputType)
  data: UpdateRestaurantInputType;  // 업데이트할 데이터 (선택적 필드)
}
```

**GraphQL Mutation**:
```graphql
mutation {
  updateRestaurant(
    id: 1
    data: {
      name: "New Pizza House"
      address: "456 New St"
      # 다른 필드는 생략 가능
    }
  ) {
    id
    name
    address
  }
}
```

---

## 💡 조합 사용 예제

Mapped Types는 체이닝이 가능합니다:

```typescript
// 1단계: id와 createdAt 제외
const WithoutAutoFields = OmitType(User, ['id', 'createdAt']);

// 2단계: 모든 필드를 optional로
const OptionalUpdate = PartialType(WithoutAutoFields);

// 3단계: 특정 필드만 선택
const OnlyNameAndEmail = PickType(OptionalUpdate, ['name', 'email']);
```

---

## 📊 Mapped Types 비교표

| Type | 기능 | 입력 | 출력 | 주요 사용처 |
|------|------|------|------|------------|
| **PartialType** | 모든 필드 optional | Type | Optional Type | Update DTO |
| **PickType** | 특정 필드 선택 | Type, Keys[] | Picked Type | Login, 부분 조회 |
| **OmitType** | 특정 필드 제외 | Type, Keys[] | Omitted Type | Create DTO |
| **IntersectionType** | 타입 결합 | Type1, Type2 | Combined Type | 복합 DTO |

---

## ⚠️ 주의사항

### 1. Import 경로

```typescript
// ✅ GraphQL 프로젝트
import { PartialType } from '@nestjs/graphql';

// ❌ REST API (Swagger)
import { PartialType } from '@nestjs/swagger';

// ❌ 일반 Mapped Types
import { PartialType } from '@nestjs/mapped-types';
```

**중요**: GraphQL 사용 시 반드시 `@nestjs/graphql`에서 import!

---

### 2. InputType vs ObjectType

```typescript
// ✅ 올바른 사용
@InputType()  // Mutation/Query 입력용
class CreateDto extends OmitType(Entity, ['id']) {}

// ❌ 잘못된 사용
@ObjectType()  // 출력용이므로 DTO에 사용 불가
class CreateDto extends OmitType(Entity, ['id']) {}
```

---

### 3. Entity에 InputType 추가

Entity를 DTO 베이스로 사용하려면:

```typescript
@InputType({ isAbstract: true })  // ← 추상 InputType으로 등록
@ObjectType()
@Entity()
export class Restaurant {
  // ...
}
```

`isAbstract: true`: 직접 사용하지 않고 상속만 가능

---

## 🎯 베스트 프랙티스

### 1. DTO 구조화

```
src/
  restaurants/
    dto/
      create-restaurant.dto.ts   # OmitType(Entity, ['id'])
      update-restaurant.dto.ts   # PartialType(CreateDto)
      login-restaurant.dto.ts    # PickType(Entity, ['email', 'password'])
    entities/
      restaurant.entity.ts
```

---

### 2. 재사용 가능한 Base DTO

```typescript
// base.dto.ts
@InputType({ isAbstract: true })
export class BaseEntityDto {
  @Field(() => Date)
  createdAt: Date;
  
  @Field(() => Date)
  updatedAt: Date;
}

// create-restaurant.dto.ts
@InputType()
export class CreateRestaurantDto extends OmitType(
  Restaurant,
  ['id', 'createdAt', 'updatedAt']
) {}
```

---

### 3. Validation과 함께 사용

```typescript
import { IsString, IsBoolean, IsOptional } from 'class-validator';

@InputType()
export class CreateRestaurantDto extends OmitType(Restaurant, ['id']) {
  @IsString()
  name: string;

  @IsBoolean()
  @IsOptional()
  isVegan?: boolean;
}
```

---

## 🚀 실전 팁

1. **Create → Update 순서로 정의**: Update는 Create를 확장
2. **Entity를 Base로 사용**: 코드 중복 최소화
3. **Validation 데코레이터 활용**: 타입 안전성 강화
4. **문서화**: JSDoc으로 각 DTO의 용도 명시

---

## 📚 추가 자료

- [NestJS GraphQL Mapped Types 공식 문서](https://docs.nestjs.com/graphql/mapped-types)
- [TypeScript Utility Types](https://www.typescriptlang.org/docs/handbook/utility-types.html)
- [Class Validator](https://github.com/typestack/class-validator)

