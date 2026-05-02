/**
 * @file Support for the Evie programming language.
 * @author Hassan <mail@hxkhan.dev>
 * @license MIT
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

export default grammar({
  name: "evie",

  rules: {
    source_file: $ => repeat($._statement),

    _statement: $ => choice(
      $.function_definition,
      $.variable_declaration,
      $.expression_statement,
      $.comment,
    ),

    expression_statement: $ => seq($._expression, optional(';')),

    // --- Functions ---
    function_definition: $ => seq(
      'fn',
      field('name', $.identifier),
      $.parameter_list,
      field('body', $.block)
    ),

    // --- Variables ---
    variable_declaration: $ => seq(
      'var',
      field('name', $.identifier),
      '=',
      field('value', $._expression),
      optional(';')
    ),

    // --- Expressions ---
    _expression: $ => choice(
      $.identifier,
      $.number,
      $.string,
      $.template_literal,
      $.binary_expression,
      $.unary_expression,
      $.parenthesized_expression,
    ),

    parenthesized_expression: $ => seq('(', $._expression, ')'),

    binary_expression: $ => choice(
      ...[
        ['&&', 1],
        ['||', 1],
        ['==', 2],
        ['!=', 2],
        ['<', 2],
        ['<=', 2],
        ['>', 2],
        ['>=', 2],
        ['+', 3],
        ['-', 3],
        ['*', 4],
        ['/', 4],
        ['%', 4],
      ].map(([operator, precedence]) =>
        prec.left(precedence, seq(
          field('left', $._expression),
          field('operator', alias(operator, $.operator)),
          field('right', $._expression)
        ))
      )
    ),

    operator: $ => choice(
      '&&', '||', '!',                // Logical
      '==', '!=', '<=', '>=', '<', '>', // Comparison
      '+=', '-=', '/=', '*=', '%=', '&=', '&=', '|=', '<<=', '>>=', ':=', '=', // Assignment
      '++', '--',                     // Increment/Decrement
      '+', '-', '/', '*', '%', '^',   // Arithmetic
      '&', '|', '<<', '>>', '&^'      // Bitwise
    ),

    unary_expression: $ => prec(5, seq(
      field('operator', choice('!', '-', '++', '--')),
      field('argument', $._expression)
    )),

    parameter_list: $ => seq('(', optional($._parameters), ')'),

    _parameters: $ => seq($.identifier, repeat(seq(',', $.identifier))),

    // --- Literals & Basic types ---
    identifier: $ => /[a-zA-Z_][a-zA-Z0-9_]*/,

    number: $ => /\d+(\.\d+)?/,

    string: $ => seq(
      '"',
      repeat(choice(/[^"\\]+/, $.escape_sequence)),
      '"'
    ),

    template_literal: $ => seq(
      '`',
      repeat(choice(
        token.immediate(/[^`\\{]+/), // Plain text
        $.escape_sequence,
        $.template_expression
      )),
      '`'
    ),

    template_expression: $ => seq(
      '{',
      $._expression,
      '}'
    ),

    escape_sequence: $ => /\\./,

    block: $ => seq('{', repeat($._statement), '}'),

    // --- Comments ---
    comment: $ => choice(
      seq('//', /.*/),
      seq('/*', /[^*]*\*+([^/*][^*]*\*+)*/, '/')
    ),
  }
});

