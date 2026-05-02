package tree_sitter_evie_test

import (
	"testing"

	tree_sitter "github.com/tree-sitter/go-tree-sitter"
	tree_sitter_evie "github.com/tree-sitter/tree-sitter-evie/bindings/go"
)

func TestCanLoadGrammar(t *testing.T) {
	language := tree_sitter.NewLanguage(tree_sitter_evie.Language())
	if language == nil {
		t.Errorf("Error loading Evie grammar")
	}
}
