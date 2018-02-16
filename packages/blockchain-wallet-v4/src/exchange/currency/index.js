import BigRational from 'big-rational'
import { compose, curry, is, prop, flip, sequence } from 'ramda'
import { view } from 'ramda-lens'
import Maybe from 'data.maybe'

import Type from '../../types/Type'
import * as Currencies from '../currencies'

export class Currency extends Type {
  toString () {
    return `Currency(${this.value} ${this.currency.code}-${this.currency.base})`
  }
  toUnit (unit) {
    if (unit.currency === this.currency.code) {
      return Maybe.Just({
        value: this.value.multiply(BigRational(unit.rate).reciprocate()).toDecimal(unit.decimal_digits),
        unit: unit
      })
    } else { return Maybe.Nothing() }
  }
  convert (pairs, toCurrency) {
    let ratio = BigRational.one
    const toCurrencyM = Maybe.fromNullable(toCurrency)
    const pairsM = Maybe.fromNullable(pairs)

    return sequence(Maybe.of, [toCurrencyM, pairsM])
    .chain(([toCurrency, pairs]) => {
      if (this.currency.code === toCurrency.code) {
        return Maybe.Just(this)
      } else if (this.currency.code === pairs.code) {
        ratio = prop(toCurrency.code, pairs.table)
      } else {
        ratio = prop(this.currency.code, pairs.table).reciprocate()
      }

      return this.toUnit(this.currency.units[this.currency.trade])
            .chain(o => fromUnit({
              value: BigRational(o.value).multiply(ratio),
              unit: toCurrency.units[toCurrency.trade]
            }))
    })
  }

  convertWithRate (toCurrency, rate, reverse) {
    let ratio = BigRational(rate)
    const toCurrencyM = Maybe.fromNullable(toCurrency)

    return sequence(Maybe.of, [toCurrencyM])
      .chain(([toCurrency]) => {
        return this.toUnit(this.currency.units[this.currency.trade])
          .chain(o => fromUnit({
            value: reverse ? BigRational(o.value).divide(ratio) : BigRational(o.value).multiply(ratio),
            unit: toCurrency.units[toCurrency.trade]
          }))
      })
  }
}
const newCurrency = o => new Currency(o)

export const isCurrency = is(Currency)
export const value = Currency.define('value')
export const currency = Currency.define('currency')

export const selectValue = view(value)
export const selectCurrency = view(currency)
export const selectUnits = compose(prop('units'), selectCurrency)

export const convert = curry((pairs, toCurrency, currencyObject) => currencyObject.convert(pairs, toCurrency))
export const convertWithRate = curry((toCurrency, rate, reverse, currencyObject) => currencyObject.convertWithRate(toCurrency, rate, reverse))
export const toUnit = curry((unit, currencyObject) => currencyObject.toUnit(unit))

export const fromUnit = ({value, unit}) => {
  const unitM = Maybe.fromNullable(unit)
  const currencyM = unitM.map(prop('currency')).map(flip(prop)(Currencies))

  return sequence(Maybe.of, [unitM, currencyM])
    .map(([unit, currency]) => newCurrency({
      value: BigRational(value).multiply(BigRational(unit.rate)),
      currency: currency
    }))
}

export const unitToString = ({value, unit}) => `${unit.symbol}${value}`