---
title: 关于消除可选链
slug: optional-chaining-bundle-size
date: '2025-12-20'
updated: '2026-07-24'
tags:
  - React
  - Typescript
summary: >-
  关于消除可选链
  读AntDesign源码的时候发现一个很有意思的现象——开发人员刻意使用全局引用的EmptyObject，即{}来消除?.可选链，官方给的注释是reduce
  bundle size，所以查了一下 可选链会增加bundle体积...
cover: null
published: true
---
# 关于消除可选链

读AntDesign源码的时候发现一个很有意思的现象——开发人员刻意使用全局引用的**Empty_Object**，即`{}`来消除?.可选链，官方给的注释是*reduce bundle size*，所以查了一下

## 可选链会增加bundle体积

假设我们有这么一行代码

```typescript
config?.classNames?.root
```

可选链在编译后会被展开成多层判空逻辑

```typescript
var _a, _b;
(_b = (_a = config) === null || _a === void 0 ? void 0 : _a.classNames) 
=== null || _b === void 0
  ? void 0
  : _b.root;
```

在组件库这种 高复用、高频率引用 的场景下：

- bundle 体积增大

- 运行时多次判空

- 增加 GC 压力

## AntDesign是如何解决的

下面是AntDesign用于提供全局配置的useComponentConfig的简化版

```typescript
const EMPTY_OBJECT = {};

export function useComponentConfig(propName) {
  const context = React.useContext(ConfigContext);
  const propValue = context[propName];

  return {
    classNames: EMPTY_OBJECT,
    styles: EMPTY_OBJECT,
    ...propValue,
  };
}
```

上面这一段关键在于：

- classNames/styles 永远存在(非undefined)
- 如果用户传了配置，会覆盖默认值(因为...propValue在下面)

这样组建内部就无需再使用可选链了

以avatar为例

```typescript

const { classNames, styles } = useComponentConfig('avatar');

const rootCls = classNames.root;
const rootStyle = styles.root;
```

## 为什么要用EMPTY_OBJECT

看似可以写成

```typescript
classNames: {}
```

但这样子会导致：

- 每次render都创建新对象
- 引用不稳定
- 增加GC压力

相反使用`const EMPTY_OBJECT = {}`;

则会：

- 全局共享一个引用
- 零额外内存
