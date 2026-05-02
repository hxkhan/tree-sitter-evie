/**
 * @file Support for the Evie programming language.
 * @author Hassan <mail@hxkhan.dev>
 * @license MIT
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

const PREC = {
  assignment: 1,
  logical_or: 2,
  logical_and: 3,
  inclusive_or: 4,
  exclusive_or: 5,
  bit_and: 6,
  equality: 7,
  relational: 8,
  shift: 9,
  additive: 10,
  multiplicative: 11,
  unary: 12,
  call: 13,
  member: 14,
};

export default grammar({
  name: "evie",

  word: $ => $.identifier,

  conflicts: $ => [
    [$._statement, $._expression],
    [$.return_statement],
    [$._expression, $.object_literal],
    [$._expression, $.lambda_expression],
    [$.identifier, $.object_literal],
    [$._expression, $.struct_definition],
    [$.await_expression, $.object_literal],
  ],

  rules: {
    source_file: $ => seq(
      optional($.package_clause),
      repeat($._statement)
    ),

    package_clause: $ => seq(
      'package',
      field('name', $.identifier),
      optional($.import_clause)
    ),

    import_clause: $ => seq(
      'imports',
      '(',
      commaSep($.string),
      ')'
    ),

    _statement: $ => choice(
      $.function_declaration,
      $.variable_declaration,
      $.assignment_statement,
      $.if_statement,
      $.while_statement,
      $.for_statement,
      $.return_statement,
      $.break_statement,
      $.continue_statement,
      $.echo_statement,
      $.throw_statement,
      $.struct_definition,
      $.switch_statement,
      $.expression_statement,
      $.comment,
    ),

    expression_statement: $ => seq($._expression, optional(';')),

    // --- Functions ---
    function_declaration: $ => seq(
      'fn',
      field('name', $.identifier),
      $.parameter_list,
      choice(
        field('body', $.block),
        seq('=>', field('body', $._expression))
      )
    ),

    lambda_expression: $ => seq(
      'fn',
      $.parameter_list,
      choice(
        field('body', $.block),
        seq('=>', field('body', $._expression))
      )
    ),

    parameter_list: $ => seq('(', commaSep($.identifier), ')'),

    // --- Variables & Assignments ---
    variable_declaration: $ => choice(
      seq('var', field('name', $.identifier), optional(seq(':=', field('value', $._expression)))),
      seq(field('left', $._expression), ':=', field('value', $._expression))
    ),

    assignment_statement: $ => prec.left(PREC.assignment, seq(
      field('left', $._expression),
      field('operator', choice('=', '+=', '-=', '*=', '/=', '%=')),
      field('right', $._expression)
    )),

    // --- Control Flow ---
    if_statement: $ => prec.left(20, seq(
      'if',
      field('condition', $._expression),
      field('consequence', $.block),
      optional($.else_clause)
    )),

    else_clause: $ => seq(
      'else',
      choice($.block, $.if_statement)
    ),

    while_statement: $ => prec.left(20, seq(
      'while',
      field('condition', $._expression),
      field('body', $.block)
    )),

    for_statement: $ => prec.left(20, seq(
      'for',
      field('left', $.for_iterator),
      ':=',
      field('right', $._expression),
      field('body', $.block)
    )),

    for_iterator: $ => choice(
      $.identifier,
      seq($.identifier, ',', $.identifier),
      $.parenthesized_expression
    ),

    return_statement: $ => prec.left(20, seq('return', optional($._expression))),
    break_statement: $ => 'break',
    continue_statement: $ => 'continue',
    echo_statement: $ => seq('echo', $._expression),
    throw_statement: $ => seq('throw', $._expression),

    switch_statement: $ => seq(
      'switch',
      optional(seq(field('name', $.identifier), ':=')),
      field('value', $._expression),
      '{',
      repeat($.case_clause),
      '}'
    ),

    case_clause: $ => seq(
      'case',
      field('value', $._expression),
      ':',
      repeat($._statement)
    ),

    // --- Types ---
    struct_definition: $ => seq(
      'struct',
      field('name', $.identifier),
      $.parameter_list,
      optional(seq(':', field('parent', $._type_identifier))),
      field('body', $.block)
    ),

    _type_identifier: $ => choice(
      $.identifier,
      $.member_expression
    ),

    // --- Expressions ---
    _expression: $ => choice(
      $.identifier,
      $.number,
      $.string,
      $.template_literal,
      $.nil,
      $.boolean,
      $.binary_expression,
      $.unary_expression,
      $.parenthesized_expression,
      $.call_expression,
      $.member_expression,
      $.index_expression,
      $.object_literal,
      $.array_literal,
      $.lambda_expression,
      $.await_expression,
      $.catch_expression,
      $.go_expression,
    ),

    nil: $ => 'nil',
    boolean: $ => choice('true', 'false'),

    parenthesized_expression: $ => seq('(', commaSep($._expression), ')'),

    binary_expression: $ => {
      const table = [
        [PREC.logical_or, '||'],
        [PREC.logical_and, '&&'],
        [PREC.equality, '=='],
        [PREC.equality, '!='],
        [PREC.relational, '<'],
        [PREC.relational, '<='],
        [PREC.relational, '>'],
        [PREC.relational, '>='],
        [PREC.relational, 'is'],
        [PREC.shift, '<<'],
        [PREC.shift, '>>'],
        [PREC.additive, '+'],
        [PREC.additive, '-'],
        [PREC.multiplicative, '*'],
        [PREC.multiplicative, '/'],
        [PREC.multiplicative, '%'],
      ];

      return choice(...table.map(([precedence, operator]) => prec.left(precedence, seq(
        field('left', $._expression),
        field('operator', alias(operator, $.operator)),
        field('right', $._expression)
      ))));
    },

    unary_expression: $ => prec(PREC.unary, seq(
      field('operator', choice('!', '-', '++', '--')),
      field('argument', $._expression)
    )),

    call_expression: $ => prec(PREC.call, seq(
      field('function', $._expression),
      field('arguments', $.argument_list)
    )),

    argument_list: $ => seq('(', commaSep($._expression), ')'),

    member_expression: $ => prec(PREC.member, seq(
      field('object', $._expression),
      field('operator', choice('.', '?.')),
      choice(
        field('property', $.identifier),
        $.optional_check
      )
    )),

    optional_check: $ => seq(field('property', $.identifier), '?'),

    index_expression: $ => prec(PREC.member, seq(
      field('object', $._expression),
      '[',
      field('index', $._expression),
      ']'
    )),

    object_literal: $ => prec(PREC.call - 2, seq(
      optional(field('type', $.identifier)),
      '{',
      commaSep($.object_property),
      '}'
    )),

    object_property: $ => seq(
      field('key', $.identifier),
      ':',
      field('value', $._expression)
    ),

    array_literal: $ => seq(
      '[',
      commaSep($._expression),
      ']'
    ),

    await_expression: $ => prec.left(PREC.unary, seq(
      'await',
      optional(choice(
        seq('{', repeat($.case_clause), '}'),
        $._expression
      ))
    )),

    catch_expression: $ => prec.left(PREC.unary, seq(
      'catch',
      $._expression
    )),

    go_expression: $ => prec.left(PREC.unary, seq(
      'go',
      $._expression
    )),

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

function commaSep(rule) {
  return optional(seq(rule, repeat(seq(',', rule)), optional(',')));
}
