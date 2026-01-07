# TypeORM: Eager Relations와 @RelationId

## 1. Eager Relations (즉시 로딩)

### 개념
Entity를 조회할 때 **관련 엔티티를 자동으로 함께 로드**하는 기능입니다.

### Entity 설정

```typescript
@Entity()
export class Restaurant {
  @ManyToOne(() => User, { eager: true })  // ⭐ eager 설정
  owner: User;

  @ManyToOne(() => Category, { eager: true })
  category: Category;
}
```

### 사용 예시

```typescript
// eager 설정된 관계는 자동 로드
const restaurant = await this.restaurant.findOne({
  where: { id: 1 },
  // relations 명시 안 해도 owner, category 자동 로드!
});

console.log(restaurant.owner.email);      // ✅ 접근 가능
console.log(restaurant.category.name);    // ✅ 접근 가능
```

## 2. loadEagerRelations 옵션

### 기본 동작

TypeORM의 `findOne()`, `find()` 등에서 eager 관계를 로드할지 제어하는 옵션입니다.

- **기본값**: `true` (eager 관계 자동 로드)
- **`false`로 설정**: eager 관계를 무시하고 로드하지 않음

### 사용 예시

```typescript
// 케이스 1: eager 관계 로드 (기본값)
const restaurant = await this.restaurant.findOne({
  where: { id: 1 },
  loadEagerRelations: true,  // 생략 가능 (기본값)
});
// restaurant.owner ✅ 로드됨
// restaurant.category ✅ 로드됨

// 케이스 2: eager 관계를 로드하지 않음 (성능 최적화)
const restaurant = await this.restaurant.findOne({
  where: { id: 1 },
  loadEagerRelations: false,
});
// restaurant.owner ❌ undefined
// restaurant.category ❌ undefined
```

### 언제 사용하나?

**`loadEagerRelations: true` (기본값)**
- 관련 엔티티가 항상 필요한 경우
- 예: 레스토랑 상세 정보 조회 시 owner 정보도 필요

**`loadEagerRelations: false`**
- 성능 최적화가 필요한 경우
- 관련 엔티티가 필요 없는 경우
- 예: ID만 확인하고 싶을 때, 권한 체크만 할 때

## 3. eager vs relations 비교

### eager 설정 (Entity에 정의)

```typescript
@Entity()
export class Restaurant {
  @ManyToOne(() => User, { eager: true })  // 항상 자동 로드
  owner: User;
}

// 조회 - relations 명시 불필요
const restaurant = await this.restaurant.findOne({ where: { id: 1 } });
// restaurant.owner ✅ 자동 로드
```

### relations 옵션 (조회 시 명시)

```typescript
@Entity()
export class Restaurant {
  @ManyToOne(() => User)  // eager 없음
  owner: User;
}

// 조회 - 매번 relations 명시 필요
const restaurant = await this.restaurant.findOne({
  where: { id: 1 },
  relations: ['owner'],  // 수동 지정
});
// restaurant.owner ✅ 로드됨
```

### 비교표

| | `eager: true` | `relations` 옵션 |
|---|---|---|
| **설정 위치** | Entity 정의 | 조회 코드 |
| **로드 시점** | 항상 자동 | 명시할 때만 |
| **유연성** | 낮음 (항상 로드) | 높음 (필요할 때만) |
| **코드 중복** | 없음 | 많음 (매번 명시) |
| **성능** | 불필요한 JOIN 발생 가능 | 필요할 때만 JOIN |

### 함께 사용하기

```typescript
@Entity()
export class Restaurant {
  @ManyToOne(() => User, { eager: true })  // eager 설정
  owner: User;

  @ManyToOne(() => Category)  // eager 없음
  category: Category;
}

// 케이스 1: eager만
const r1 = await this.restaurant.findOne({ where: { id: 1 } });
// r1.owner ✅ 자동 로드 (eager)
// r1.category ❌ undefined

// 케이스 2: eager + relations
const r2 = await this.restaurant.findOne({
  where: { id: 1 },
  relations: ['category'],
});
// r2.owner ✅ 자동 로드 (eager)
// r2.category ✅ 로드 (relations)

// 케이스 3: eager 무시
const r3 = await this.restaurant.findOne({
  where: { id: 1 },
  loadEagerRelations: false,
});
// r3.owner ❌ undefined (eager 무시)
// r3.category ❌ undefined
```

## 4. @RelationId 데코레이터

### 개념

**관계 엔티티의 ID를 별도 프로퍼티로 노출**시켜주는 TypeORM 데코레이터입니다.

`ManyToOne` 관계에서 **One에 해당되는 entity의 id를 추출해서 외래키로 저장**하는 기능입니다.

### 사용 예시

```typescript
@Entity()
export class Restaurant {
  @ManyToOne(() => User)
  owner: User;  // User 엔티티 전체 (JOIN 필요)

  @RelationId((restaurant: Restaurant) => restaurant.owner)
  ownerId: number;  // User의 ID만 (JOIN 불필요, 외래키 값)
}
```

### 데이터베이스 구조

```sql
-- Many 쪽(Restaurant)에 외래키가 생성됨
CREATE TABLE restaurant (
  id SERIAL PRIMARY KEY,
  name VARCHAR,
  ownerId INTEGER,  -- 👈 외래키 (User의 id)
  categoryId INTEGER,
  
  FOREIGN KEY (ownerId) REFERENCES user(id),
  FOREIGN KEY (categoryId) REFERENCES category(id)
);

CREATE TABLE user (
  id SERIAL PRIMARY KEY,
  email VARCHAR
);
```

### 실제 데이터 예시

```
user 테이블:
+----+------------------+
| id | email            |
+----+------------------+
| 1  | john@example.com |
| 2  | jane@example.com |
+----+------------------+

restaurant 테이블:
+----+-------------+---------+------------+
| id | name        | ownerId | categoryId |
+----+-------------+---------+------------+
| 1  | 맛집        | 1       | 10         |
| 2  | 식당        | 1       | 11         |
| 3  | 카페        | 2       | 12         |
+----+-------------+---------+------------+
```

### 왜 필요한가?

**@RelationId 없이:**
```typescript
const restaurant = await this.restaurant.findOne({ 
  where: { id: 1 },
  loadEagerRelations: false,
});

// ❌ owner 엔티티가 로드 안 되어서 불가능
console.log(restaurant.owner.id);  // Error: Cannot read property 'id' of undefined
```

**@RelationId 사용:**
```typescript
const restaurant = await this.restaurant.findOne({ 
  where: { id: 1 },
  loadEagerRelations: false,
});

// ✅ ownerId는 바로 접근 가능!
console.log(restaurant.ownerId);  // 3
```

### 활용 사례: 권한 체크 (성능 최적화)

```typescript
async editRestaurant(authUser: User, restaurantId: number) {
  // JOIN 없이 restaurant만 조회
  const restaurant = await this.restaurant.findOne({
    where: { id: restaurantId },
    loadEagerRelations: false,
  });
  
  if (!restaurant) {
    throw new Error('Restaurant not found');
  }
  
  // owner 엔티티 로드 없이 ID로 권한 체크 (성능 최적화)
  if (restaurant.ownerId !== authUser.id) {
    throw new Error('Not authorized');
  }
  
  // 수정 로직...
}
```

### 장점

1. **성능 최적화**: JOIN 없이 외래키 ID만 가져올 수 있음
2. **편의성**: 관계 엔티티 로드 없이도 ID 접근 가능
3. **명시성**: 코드에서 ID 필드가 명확히 보임
4. **타입 안정성**: TypeScript에서 `ownerId`가 명확한 타입으로 정의됨

### ⚠️ 중요: @RelationId는 "가상 프로퍼티"

**@RelationId의 정확한 동작 방식:**

1. **데이터베이스 레벨**: `ownerId` 컬럼은 실제로 존재합니다 (Foreign Key)
2. **TypeORM 레벨**: `@RelationId`는 그 FK 컬럼 값을 TypeScript 코드에서 접근할 수 있게 매핑
3. **"가상"의 의미**: TypeORM의 추상화 레벨에서는 가상 프로퍼티로 취급됨

```typescript
@Entity()
export class Restaurant {
  @ManyToOne(() => User)
  owner: User;
  
  @RelationId((restaurant: Restaurant) => restaurant.owner)
  ownerId: number;  // ← TypeORM이 DB의 FK 컬럼을 매핑
}
```

**실제 PostgreSQL 테이블:**
```sql
CREATE TABLE restaurant (
  id INTEGER PRIMARY KEY,
  name VARCHAR,
  ownerId INTEGER,  -- ← 실제 컬럼 (자동 생성)
  FOREIGN KEY (ownerId) REFERENCES user(id)
);
```

**언제 값이 채워지나?**
- ❌ 서버 시작 시 생성되는 것이 아님
- ✅ 엔티티를 DB에서 조회할 때마다 자동으로 매핑됨

```typescript
// 1. DB에서 조회 시
const restaurant = await repo.findOne({ where: { id: 1 } });
// TypeORM이 SELECT 결과의 ownerId 컬럼 값을 자동으로 매핑
console.log(restaurant.ownerId);  // 10

// 2. 새로 생성 시
const newRestaurant = repo.create({ name: 'Pizza' });
newRestaurant.owner = someUser;  // User 객체 할당
await repo.save(newRestaurant);
// 저장 후 newRestaurant.ownerId에 자동으로 someUser.id가 설정됨

// 3. 직접 할당도 가능
const restaurant = new Restaurant();
restaurant.ownerId = 5;  // FK 값 직접 할당
await repo.save(restaurant);
```

### 🚨 제약사항: where 절에서 사용 불가

`@RelationId`는 TypeORM의 일반 `where` 절에서 직접 사용할 수 없습니다:

```typescript
// ❌ 작동하지 않음
await this.restaurant.count({ 
  where: { ownerId: 5 } 
});
// Error: Property "ownerId" was not found in "Restaurant"

// ✅ 방법 1: 관계를 통한 접근
await this.restaurant.count({ 
  where: { owner: { id: 5 } } 
});

// ✅ 방법 2: QueryBuilder 사용 (실제 컬럼 이름 사용)
await this.restaurant
  .createQueryBuilder('restaurant')
  .where('restaurant.ownerId = :ownerId', { ownerId: 5 })
  .getCount();
```

**왜 where 절에서 안 될까?**
- TypeORM의 `find()`, `findOne()` 등은 **엔티티 프로퍼티 기반**으로 동작
- `@RelationId`는 TypeORM의 추상화 레벨에서 가상 프로퍼티로 취급
- QueryBuilder는 **실제 SQL 컬럼 이름**을 직접 사용하므로 가능

### 비교: 실제 컬럼 vs @RelationId 프로퍼티

| 구분 | **실제 DB 컬럼** | **@RelationId 프로퍼티** |
|------|------------------|-------------------------|
| **생성 주체** | TypeORM의 `@ManyToOne` | TypeScript 매핑 |
| **저장 위치** | PostgreSQL 테이블 | 메모리 (조회 시) |
| **생성 시점** | Migration/Synchronize | 엔티티 로드 시마다 |
| **where 절 사용** | ❌ (QueryBuilder는 ✅) | ❌ |
| **직접 접근** | ❌ (SQL로만) | ✅ `restaurant.ownerId` |
| **값 할당** | ❌ (ORM이 관리) | ✅ 직접 할당 가능 |

## 5. 실전 예시

### Restaurant Entity 전체 구조

```typescript
@Entity()
export class Restaurant extends CoreEntity {
  @Column()
  name: string;

  // Category 관계 (nullable)
  @ManyToOne(() => Category, (category) => category.restaurants, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  category: Category;

  @RelationId((restaurant: Restaurant) => restaurant.category)
  categoryId: number;  // Category의 ID

  // Owner 관계 (필수)
  @ManyToOne(() => User, (user) => user.restaurants, { 
    onDelete: 'CASCADE' 
  })
  owner: User;

  @RelationId((restaurant: Restaurant) => restaurant.owner)
  ownerId: number;  // User의 ID
}
```

### 활용 예시

```typescript
// 1. 레스토랑 목록 조회 (ID만 필요)
const restaurants = await this.restaurant.find({
  loadEagerRelations: false,
});
// restaurants[0].ownerId ✅ 접근 가능 (JOIN 없음, 성능 좋음)
// restaurants[0].owner ❌ undefined

// 2. 레스토랑 상세 조회 (owner 정보 필요)
const restaurant = await this.restaurant.findOne({
  where: { id: 1 },
  relations: ['owner', 'category'],
});
// restaurant.owner ✅ 전체 정보
// restaurant.ownerId ✅ ID도 접근 가능

// 3. 권한 체크만 필요한 경우
const restaurant = await this.restaurant.findOne({
  where: { id: restaurantId },
  select: ['id', 'ownerId'],  // 필요한 컬럼만 선택
  loadEagerRelations: false,
});
if (restaurant.ownerId !== authUser.id) {
  throw new Error('Not authorized');
}
```

## 6. 베스트 프랙티스

### eager 사용 권장 사항

- **사용**: 거의 항상 함께 조회되는 관계 (예: User의 Profile)
- **사용 안 함**: 선택적으로 필요한 관계 (예: Restaurant의 Category)

### @RelationId 사용 권장 사항

- **항상 추가**: 권한 체크, ID 비교 등에 유용
- **성능**: 불필요한 JOIN을 피할 수 있음
- **명시성**: 코드 가독성 향상

### 예시

```typescript
@Entity()
export class Restaurant {
  // ❌ 나쁜 예: Category가 항상 필요하지 않은데 eager 설정
  @ManyToOne(() => Category, { eager: true })
  category: Category;

  // ✅ 좋은 예: 필요할 때만 relations로 로드
  @ManyToOne(() => Category)
  category: Category;

  // ✅ 항상 추가: ID로 빠른 접근 가능
  @RelationId((restaurant: Restaurant) => restaurant.category)
  categoryId: number;
}
```

## 요약

- **`eager: true`**: Entity 정의에서 항상 자동 로드 설정
- **`relations` 옵션**: 조회 시 명시적으로 로드할 관계 지정
- **`loadEagerRelations`**: eager 관계 로드 여부 제어 (기본: true)
- **`@RelationId`**: 
  - 실제 DB의 FK 컬럼을 TypeScript 코드에서 접근 가능하게 매핑
  - 엔티티 조회 시마다 자동으로 값이 채워짐
  - TypeORM의 `where` 절에서는 사용 불가 (QueryBuilder는 가능)
  - 성능 최적화에 유용 (JOIN 없이 ID 접근)

