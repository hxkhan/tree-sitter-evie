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
    [$._expression, $.object_literal],
    [$._type_identifier, $.object_literal],
    [$._expression, $._type_identifier],
  ],

  rules: {
    source_file: $ => seq(
      optional($.package_clause),
      repeat($._statement)
    ),

    package_clause: $ => seq(
      $._keyword_package,
      field('name', $.identifier),
      optional($.import_clause)
    ),

    import_clause: $ => seq(
      $._keyword_imports,
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
      $._keyword_fn,
      field('name', $.identifier),
      $.parameter_list,
      choice(
        field('body', $.block),
        seq('=>', field('body', $._expression))
      )
    ),

    lambda_expression: $ => seq(
      $._keyword_fn,
      $.parameter_list,
      choice(
        field('body', $.block),
        seq('=>', field('body', $._expression))
      )
    ),

    parameter_list: $ => seq('(', commaSep($.identifier), ')'),

    // --- Variables & Assignments ---
    variable_declaration: $ => seq(
      // Handles: var x = 100, let y: int = 100, etc.
      choice($._keyword_var, $._keyword_let),
      field('name', $.identifier),
      optional(seq(':', field('type', $._type_identifier))),
      optional(seq('=', field('value', $._expression)))
    ),

    assignment_statement: $ => prec.left(PREC.assignment, seq(
      field('left', $._expression),
      field('operator', choice('=', '+=', '-=', '*=', '/=', '%=')),
      field('right', $._expression)
    )),

    // --- Control Flow ---
    if_statement: $ => prec.left(20, seq(
      $._keyword_if,
      field('condition', $._expression),
      field('consequence', $.block),
      optional($.else_clause)
    )),

    else_clause: $ => seq(
      $._keyword_else,
      choice($.block, $.if_statement)
    ),

    while_statement: $ => prec.left(20, seq(
      $._keyword_while,
      field('condition', $._expression),
      field('body', $.block)
    )),

    for_statement: $ => prec.left(20, seq(
      $._keyword_for,
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

    return_statement: $ => prec.left(20, seq($._keyword_return, optional($._expression))),
    break_statement: $ => $._keyword_break,
    continue_statement: $ => $._keyword_continue,
    echo_statement: $ => seq($._keyword_echo, $._expression),
    throw_statement: $ => seq($._keyword_throw, $._expression),

    switch_statement: $ => seq(
      $._keyword_switch,
      optional(seq(field('name', $.identifier), ':=')),
      field('value', $._expression),
      '{',
      repeat($.case_clause),
      '}'
    ),

    case_clause: $ => seq(
      $._keyword_case,
      field('value', $._expression),
      ':',
      repeat($._statement)
    ),

    // --- Types ---
    struct_definition: $ => seq(
      $._keyword_struct,
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

    nil: $ => $._keyword_nil,
    boolean: $ => choice($._keyword_true, $._keyword_false),

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
        [PREC.relational, $._keyword_is],
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

    object_literal: $ => prec(PREC.assignment - 1, seq(
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
      $._keyword_await,
      optional(choice(
        seq('{', repeat($.case_clause), '}'),
        $._expression
      ))
    )),

    catch_expression: $ => prec.left(PREC.unary, seq(
      $._keyword_catch,
      $._expression
    )),

    go_expression: $ => prec.left(PREC.unary, seq(
      $._keyword_go,
      $._expression
    )),

    // --- Keywords ---
    _keyword_package: $ => 'package',
    _keyword_imports: $ => 'imports',
    _keyword_fn: $ => 'fn',
    _keyword_var: $ => 'var',
    _keyword_let: $ => 'let',
    _keyword_if: $ => 'if',
    _keyword_else: $ => 'else',
    _keyword_while: $ => 'while',
    _keyword_for: $ => 'for',
    _keyword_return: $ => 'return',
    _keyword_break: $ => 'break',
    _keyword_continue: $ => 'continue',
    _keyword_echo: $ => 'echo',
    _keyword_throw: $ => 'throw',
    _keyword_switch: $ => 'switch',
    _keyword_case: $ => 'case',
    _keyword_struct: $ => 'struct',
    _keyword_nil: $ => 'nil',
    _keyword_true: $ => 'true',
    _keyword_false: $ => 'false',
    _keyword_is: $ => 'is',
    _keyword_await: $ => 'await',
    _keyword_catch: $ => 'catch',
    _keyword_go: $ => 'go',

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
