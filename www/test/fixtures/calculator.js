// Calculator module that uses utils
const { add, multiply } = require('./utils');

class Calculator {
  constructor() {
    this.result = 0;
  }

  addNumbers(a, b) {
    this.result = add(a, b);
    return this.result;
  }

  multiplyNumbers(a, b) {
    this.result = multiply(a, b);
    return this.result;
  }

  calculate(operation, x, y) {
    if (operation === 'add') {
      return this.addNumbers(x, y);
    } else if (operation === 'multiply') {
      return this.multiplyNumbers(x, y);
    }
    return null;
  }

  getResult() {
    return this.result;
  }
}

module.exports = Calculator;
