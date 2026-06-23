[TOC]

## 1、功能描述

TOPPayJSSDK 开发包（后面简称 SDK）主要用来向第三方应用程序提供便捷、安全以及可靠的支付服务。本文主要描述 SDK 的接入和使用方法，该文档仅供研发接入参考。

## 2、SDK 接入前准备

- 接入前期准备工作， 需要找平台获取的参数<font color=red>(可以通过对接群联系平台运营人员获取)</font>：

| 参数名称     | 参数说明                 |
| :----------- | :----------------------- |
| paymentAppId | 平台分配给研发的应用 id  |
| secretKey    | 平台分配给研发的支付秘钥 |

- 接入前期准备工作， 需要提供给平台的参数：

| 参数名称         | 参数说明                                                     |
| :--------------- | :----------------------------------------------------------- |
| 充值结果回调接口 | 即充值结果通知地址，当支付成功后，SDK 服务器会将支付结果回调给该接口 |
| 产品icon         | 需要接入支付的产品icon图片                                   |
| 产品名           | 需要接入支付的产品名                                         |

## 3、SDK 快速接入

### 3.1、JSSDK 引入

- 在需要调用 TOPPay 功能的页面引入的 jssdk，直接放在 HTML 的 body 中：

```js
<script src="https://cdn-game.meetsocial.com/n/cnvd8bz4ar5u/b/pkg-juhepay/o/jssdk/pay-sdk-1.0.4.js"></script>
```

## 4、SDK 接口使用说明

### 4.1、初始化接口（必接）

```javascript
window.paySDK && window.paySDK.init();
```

> 该接⼝⽤于进⾏ SDK 初始化操作

### 4.2、支付接口（必接）

```javascript
window.paySDK?.payOrder(
  {
    source: 'webview',
    paymentAppId: paymentAppId,
    outTradeCode: outTradeCode,
    amount: amount,
    currencyCode: currencyCode,
    secret: secret,
    callbackUrl: callbackUrl,
    products: [
      {
        productName: '商品名称1',
        productCount: 2,
        productPrice: 5,
      },
      {
        productName: '商品名称2',
        productCount: 1,
        productPrice: 10,
      },
    ],
  }
);
```

> 该接⼝⽤于调用支付功能

**参数**：

| 参数          | 说明                                                                        | 类型   | 是否必传                  |
| ------------ | ---------------------------------------------------------------------------- | ------ | ------------------------- |
| paymentAppId | 平台分配给研发的应用 id                                                      | string | <font color=red>是</font> |
| outTradeCode | CP 订单号                                                                    | string | <font color=red>是</font> |
| amount       | 商品总价<font color=red>(单位为最小单位，美分)</font>          | number    | <font color=red>是</font> |
| currencyCode | 币种<font color=red>(目前固定传入 USD)</font>                                | string | <font color=red>是</font> |
| secret       | 订单签名<font color=red>(请使用分配的支付秘钥 secretKey 进行签名处理)</font> | string | <font color=red>是</font> |
| callbackUrl | 回调地址<font color=red>(该地址用于sdk回调，会跳到该地址并且会在地址后面拼接对应参数)</font> | string | <font color=red>是</font> |
| products     | 商品列表信息(请按实际传入对应信息)                                   | Array<{ productName: string;productCount: number; productPrice: number}> | <font color=red>是</font> |
| source       | 页面用途（web，webview）,支付场景应用于apk和ipa包内，请传入webview，否则传入web | string | <font color=red>是</font> |

<font color=red>注：为了保护充值的安全性，此部分的签名操作一定要放在CP服务端完成，否则暴露出CP服务端 secretKey 会有很大风险。</font>

```java
订单签名secret算法：md5(`amount=${amount}&outTradeCode=${outTradeCode}&currencyCode=USD&secretKey=${secretKey}`)

1、${amount} 需要换成实际商品总价

2、${outTradeCode} 需要换成实际CP订单号

3、${secretKey} 需要换成实际分配的支付秘钥
```

**返回结果**：


```
支付完成后会跳转传入的回调地址并且会在地址后面拼接对应参数，例如
callbackUrl?outTradeCode=xxx&payId=xxx&payMethod=CHECKOUT_HOSTED_CARD&status=success
```

| 参数         | 说明                                                         | 类型   | 是否必返回                |
| ------------ | ------------------------------------------------------------ | ------ | ------------------------- |
| outTradeCode | CP 订单号                                                    | string | <font color=red>是</font> |
| payId        | 平台流水号                                                   | string | 否                        |
| payMethod    | 支付方式（card支付：CHECKOUT_HOSTED_CARD； mada支付：CHECKOUT_HOSTED_MADA ；google支付:CHECKOUT_GOOGLE_PAY） | string | 否                        |
| status       | 支付状态（支付成功:success; 支付失败:faild；支付取消:cancel） | string | <font color=red>是</font> |

##  5、支付测试

- <font color=red>测试支付时，请使用外币种储蓄卡或信用卡</font>

